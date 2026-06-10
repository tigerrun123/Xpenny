const conversations = new Map();

export function getConversation(chatId) {
  return conversations.get(chatId) || [];
}

export function appendMessage(chatId, role, content) {
  const history = getConversation(chatId);
  const nextHistory = [...history, { role, content }].slice(-16);
  conversations.set(chatId, nextHistory);
  return nextHistory;
}

export function clearConversation(chatId) {
  conversations.delete(chatId);
}

