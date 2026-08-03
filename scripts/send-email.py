import os
import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email():
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = os.environ.get('SMTP_PORT', '465')
    smtp_user = os.environ.get('SMTP_USER')
    smtp_pass = os.environ.get('SMTP_PASS')
    to_email = os.environ.get('NOTIFICATION_EMAIL')
    
    if not all([smtp_host, smtp_user, smtp_pass, to_email]):
        print("SMTP configurations are missing in environment variables.")
        sys.exit(1)
        
    subject = sys.argv[1] if len(sys.argv) > 1 else "Health Report"
    # Read HTML body from standard input
    body = sys.stdin.read()
    
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = smtp_user
    msg['To'] = to_email
    
    part = MIMEText(body, 'html', 'utf-8')
    msg.attach(part)
    
    try:
        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port)
        else:
            server = smtplib.SMTP(smtp_host, port)
            server.starttls()
            
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_email, msg.as_string())
        server.quit()
        print("Email sent successfully via Python smtplib.")
    except Exception as e:
        print(f"Failed to send email: {e}")
        sys.exit(1)

if __name__ == '__main__':
    send_email()
