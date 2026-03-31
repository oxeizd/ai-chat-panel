import { AgentConfig } from 'types';

export const useAgentApi = (agents: AgentConfig[] | undefined, selectedAgent: string) => {
  const currentAgent = agents?.find(agent => agent.name === selectedAgent) || agents?.[0];

  const sendMessage = async (message: string): Promise<string> => {
    if (!currentAgent) throw new Error('Агент не выбран');
    try {
      const response = await fetch(currentAgent.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, config: currentAgent.config ? JSON.parse(currentAgent.config) : {} }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.reply || 'Ответ не получен';
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      throw error;
    }
  };

  return { sendMessage };
};