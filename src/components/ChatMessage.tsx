import type { Message } from '../types/monkey';
import { FormattedMessage } from './FormattedMessage';
import { EventProposalResults } from './proposals/EventProposalResults';
import type { ProposalActions } from './proposals/EventProposalResults';
export function ChatMessage({ message, proposalActions, proposalDisabled }: { message: Message; proposalActions: ProposalActions; proposalDisabled: boolean }) {
  return <article data-message-id={message.id} className={`message ${message.role}`}><div>{message.type === 'event_proposals' ? <EventProposalResults data={message.data} event={message.event} actions={proposalActions} disabled={proposalDisabled}/> : message.role === 'assistant' ? <FormattedMessage text={message.text}/> : message.text}</div></article>;
}
