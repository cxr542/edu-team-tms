/** Cloud Learning Chatbot — Render 운영 (apps/cloud-chatbot) */
export const CLOUD_CHATBOT_PROD_ORIGIN =
  import.meta.env.VITE_CLOUD_CHATBOT_ORIGIN || 'https://cloud-chatbot-963d.onrender.com';

const VIEW_PATHS = {
  home: '/home',
  student: '/',
  admin: '/admin/',
};

/** TMS embed iframe URL */
export function cloudChatbotEmbedUrl(view = 'home') {
  const origin = String(CLOUD_CHATBOT_PROD_ORIGIN).replace(/\/$/, '');
  const path = VIEW_PATHS[view] || VIEW_PATHS.home;
  return `${origin}${path}`;
}

export function buildCloudChatbotModuleUrl({ mode = 'edit', view = 'home' } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  url.searchParams.set('module', 'cloud-chatbot');
  if (view && view !== 'home') url.searchParams.set('chatbotView', view);
  else url.searchParams.delete('chatbotView');
  return `${url.pathname}${url.search}`;
}
