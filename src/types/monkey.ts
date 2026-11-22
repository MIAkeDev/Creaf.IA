export type MonkeyState = 'sleeping' | 'waking' | 'annoyed' | 'thinking' | 'searching' | 'friendly' | 'confused';
import type { EventState } from './event';
import type { ProposalResults } from './proposal';
export type Message =
  | { type: 'text'; id: number; role: 'user' | 'assistant'; text: string }
  | { type: 'event_proposals'; id: number; role: 'assistant'; data: ProposalResults; event: EventState };
