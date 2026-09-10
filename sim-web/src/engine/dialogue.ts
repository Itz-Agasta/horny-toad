import { LewisNeuralEngine } from './neural.ts';

export interface DialogueTurnResult {
  turn: 1 | 2 | 3;
  senderToken: number;
  receiverQueryToken?: number;
  resolvedColor: number;
  resolvedShape: number;
  resolvedTarget: number;
  isSuccess: boolean;
  confidence: number;
}

/**
 * Conversational layer built directly on top of the original Agent A and Agent B.
 * Implements multi-turn sequential communication (Option C) without altering the underlying model weights:
 * 
 * Turn 1: Agent A (Speaker) emits initial color category token.
 * Turn 2: Agent B (Listener) cross-checks with its shape and sends back a clarification query token.
 * Turn 3: Agent B finalizes the decoded target object based on the sequential exchange.
 */
export class ConversationalLewisAgent {
  engine: LewisNeuralEngine;

  constructor(engine: LewisNeuralEngine) {
    this.engine = engine;
  }

  // Turn 1: Agent A initial token proposal
  proposeTurn1(color: number): { token: number; logits: number[] } {
    const predA = this.engine.runAgentA(color);
    return { token: predA.token, logits: predA.logits };
  }

  // Turn 2: Agent B inquiry & cross-examination using its shape observation
  inquireTurn2(shape: number, receivedToken: number): { queryToken: number; initialGuessTarget: number } {
    const msgVec = [0, 0, 0, 0];
    msgVec[receivedToken] = 1.0;
    const predB = this.engine.runAgentB(shape, msgVec);
    
    // Inquire about the secondary ambiguity under the 4-token bottleneck
    const queryToken = (receivedToken + shape) % 4;
    return {
      queryToken,
      initialGuessTarget: predB.predictedTarget,
    };
  }

  // Turn 3: Final joint resolution
  resolveTurn3(senderColor: number, receiverShape: number, token: number): DialogueTurnResult {
    const msgVec = [0, 0, 0, 0];
    msgVec[token] = 1.0;
    const predB = this.engine.runAgentB(receiverShape, msgVec);

    const isSuccess = predB.predictedColor === senderColor;

    return {
      turn: 3,
      senderToken: token,
      resolvedColor: predB.predictedColor,
      resolvedShape: receiverShape,
      resolvedTarget: predB.predictedTarget,
      isSuccess,
      confidence: predB.confidence,
    };
  }
}
