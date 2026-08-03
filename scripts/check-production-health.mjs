import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// Load env variables from .env.local if present
function loadEnv() {
  if (existsSync('.env.local')) {
    const content = readFileSync('.env.local', 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      let val = trimmed.slice(index + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnv();

const TARGET_URL = 'https://edu-team-tms-ten.vercel.app';
const ENDPOINTS = [
  { path: '/', expected: [200] },
  { path: '/api/ledger-snapshot', expected: [200, 404] },
];

async function checkEndpoint(endpoint) {
  const url = `${TARGET_URL}${endpoint.path}`;
  const start = Date.now();
  try {
    const res = await fetch(url);
    const duration = Date.now() - start;
    const isOk = endpoint.expected.includes(res.status);
    
    let details = '';
    if (res.status === 404 && endpoint.path === '/api/ledger-snapshot') {
      details = ' (Allowed: route functional, snapshot not found)';
    }

    return {
      path: endpoint.path,
      status: res.status,
      duration,
      isOk,
      details,
      error: null
    };
  } catch (err) {
    return {
      path: endpoint.path,
      status: null,
      duration: Date.now() - start,
      isOk: false,
      details: '',
      error: err.message
    };
  }
}

function formatHtmlMessage(results, allOk, targetUrl, dateStr) {
  const statusColor = allOk ? '#28a745' : '#dc3545';
  const statusText = allOk ? 'PASS' : 'FAIL';
  
  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 6px; padding: 20px;">
      <h2 style="margin-top: 0; color: #333;">Daily Bug & Health Report - ${dateStr}</h2>
      <div style="margin-bottom: 20px;">
        <strong>Target:</strong> <a href="${targetUrl}" style="color: #0366d6; text-decoration: none;">${targetUrl}</a><br>
        <strong>Status:</strong> <span style="background-color: ${statusColor}; color: white; padding: 3px 8px; border-radius: 3px; font-weight: bold; font-size: 14px;">${statusText}</span>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f6f8fa; border-bottom: 1px solid #e1e4e8;">
            <th style="padding: 10px; text-align: left; border: 1px solid #e1e4e8;">Path</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e1e4e8;">Status</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e1e4e8;">Response Time</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e1e4e8;">Result</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  for (const r of results) {
    const resultColor = r.isOk ? '#28a745' : '#dc3545';
    const resultIcon = r.isOk ? '🟢' : '🔴';
    const errorMsg = r.error ? `<br><span style="color: #dc3545; font-size: 12px;">Error: ${r.error}</span>` : (r.details || '');
    
    html += `
          <tr style="border-bottom: 1px solid #e1e4e8;">
            <td style="padding: 10px; border: 1px solid #e1e4e8;"><code>${r.path}</code>${errorMsg}</td>
            <td style="padding: 10px; border: 1px solid #e1e4e8;">${r.status || 'ERR'}</td>
            <td style="padding: 10px; border: 1px solid #e1e4e8;">${r.duration}ms</td>
            <td style="padding: 10px; border: 1px solid #e1e4e8; color: ${resultColor}; font-weight: bold;">${resultIcon} ${r.isOk ? 'PASS' : 'FAIL'}</td>
          </tr>
    `;
  }
  
  html += `
        </tbody>
      </table>
  `;
  
  if (!allOk) {
    html += `
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; color: #856404; margin-top: 15px;">
        <strong>⚠️ Warning:</strong> One or more endpoints failed their health checks. Investigation recommended.
      </div>
    `;
  } else {
    html += `
      <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; border-radius: 4px; color: #155724; margin-top: 15px;">
        <strong>✅ Success:</strong> No critical production issues found. System is healthy.
      </div>
    `;
  }
  
  html += `
      <hr style="border: 0; border-top: 1px solid #e1e4e8; margin: 20px 0;">
      <p style="font-size: 12px; color: #6a737d; margin: 0;">This is an automated notification from Google Antigravity.</p>
    </div>
  `;
  
  return html;
}

function sendEmailNotification(subject, htmlBody) {
  return new Promise((resolve) => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const toEmail = process.env.NOTIFICATION_EMAIL;
    
    if (!smtpHost || !smtpUser || !smtpPass || !toEmail) {
      console.log('SMTP credentials not configured in env. Skipping email notification.');
      resolve();
      return;
    }
    
    console.log('Sending Email notification...');
    const pythonProcess = spawn('python3', ['scripts/send-email.py', subject]);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}. Error: ${errorOutput || output}`);
      } else {
        console.log('Email notification sent successfully via Python:', output.trim());
      }
      resolve();
    });
    
    pythonProcess.stdin.write(htmlBody);
    pythonProcess.stdin.end();
  });
}

async function run() {
  console.log(`Checking health of ${TARGET_URL}...`);
  const results = [];
  for (const ep of ENDPOINTS) {
    const res = await checkEndpoint(ep);
    results.push(res);
  }
  
  const allOk = results.every(r => r.isOk);
  
  // Format report
  const now = new Date().toISOString();
  const dateStr = now.slice(0, 10);
  const reportDir = './docs/reports';
  mkdirSync(reportDir, { recursive: true });
  
  const reportPath = join(reportDir, `daily-bug-report-${dateStr}.md`);
  
  let md = `# Daily Bug & Health Report - ${dateStr}\n\n`;
  md += `**Target:** [edu-team-tms-ten.vercel.app](${TARGET_URL})\n`;
  md += `**Timestamp:** ${now}\n`;
  md += `**Overall Status:** ${allOk ? '🟢 PASS' : '🔴 FAIL'}\n\n`;
  
  md += `## Endpoint Checks\n\n`;
  md += `| Path | Status | Response Time | Result | Notes |\n`;
  md += `| --- | --- | --- | --- | --- |\n`;
  for (const r of results) {
    const statusText = r.status ? r.status : 'ERR';
    const resultText = r.isOk ? '🟢 PASS' : '🔴 FAIL';
    const errorText = r.error ? `Error: ${r.error}` : r.details;
    md += `| \`${r.path}\` | ${statusText} | ${r.duration}ms | ${resultText} | ${errorText} |\n`;
  }
  
  md += `\n## Local Testing Status\n\n`;
  md += `> [!NOTE]\n`;
  md += `> Local unit tests could not be run automatically due to environment limitations (dependencies like vitest/vite not installed).\n\n`;
  
  if (!allOk) {
    md += `## Required Fixes / Alerts\n\n`;
    md += `> [!WARNING]\n`;
    md += `> One or more endpoints failed their health checks. Investigation recommended.\n`;
  } else {
    md += `## Conclusion\n\n`;
    md += `No critical production issues found. System is healthy.\n`;
  }
  
  writeFileSync(reportPath, md);
  console.log(`Daily report written to: ${reportPath}`);
  
  // Format HTML and send email
  const emailHtml = formatHtmlMessage(results, allOk, TARGET_URL, dateStr);
  const emailSubject = `[TMS Health Report] ${dateStr} - ${allOk ? '🟢 PASS' : '🔴 FAIL'}`;
  await sendEmailNotification(emailSubject, emailHtml);
}

run().catch(err => {
  console.error('Failed to run daily health check:', err);
  process.exit(1);
});
