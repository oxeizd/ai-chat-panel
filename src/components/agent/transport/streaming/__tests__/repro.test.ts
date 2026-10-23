import { createInitialStreamState, appendTextDelta } from '../processor';
import { EventBus } from 'components/agent/core/eventBus';

it('repro3', () => {
  let state = createInitialStreamState();
  const bus = new EventBus();
  // эмулируем executor: START меняет currentMessageId ДО дельты
  state.currentMessageId = 'm1';
  state = appendTextDelta(state, 'AAA', bus, { paragraphBetweenMessages: true, messageId: 'm1' });
  state.currentMessageId = 'm2';
  state = appendTextDelta(state, 'BBB', bus, { paragraphBetweenMessages: true, messageId: 'm2' });
  console.log('RESULT:', JSON.stringify(state.fullReply));
});
