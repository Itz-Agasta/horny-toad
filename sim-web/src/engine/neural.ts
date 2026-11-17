// Neural forward pass for Agent A and Agent B using exported weights

export interface ModelWeights {
  agent_a: {
    'color_embed.weight': number[][]; // [8, 64]
    'msg_head.0.weight': number[][];   // [64, 64]
    'msg_head.0.bias': number[];       // [64]
    'msg_head.2.weight': number[][];   // [4, 64]
    'msg_head.2.bias': number[];       // [4]
  };
  agent_b: {
    'shape_embed.weight': number[][];   // [8, 64]
    'msg_encoder.0.weight': number[][]; // [64, 4]
    'msg_encoder.0.bias': number[];     // [64]
    'decision.0.weight': number[][];    // [64, 128]
    'decision.0.bias': number[];        // [64]
    'decision.2.weight': number[][];    // [64, 64]
    'decision.2.bias': number[];        // [64]
  };
  vocab_size: number;
  n_colors: number;
  n_shapes: number;
  n_objects: number;
}

export interface AgentAPrediction {
  token: number;
  logits: number[];
  probs: number[];
}

export interface AgentBPrediction {
  predictedTarget: number;
  predictedColor: number;
  predictedShape: number;
  confidence: number;
  logits: number[];
}

function relu(x: number[]): number[] {
  return x.map((v) => (v > 0 ? v : 0));
}

function matvec(W: number[][], b: number[], x: number[]): number[] {
  const out = new Array(W.length);
  for (let i = 0; i < W.length; i++) {
    let sum = b[i];
    const row = W[i];
    for (let j = 0; j < x.length; j++) {
      sum += row[j] * x[j];
    }
    out[i] = sum;
  }
  return out;
}

function softmax(logits: number[], temperature: number = 1.0): number[] {
  const maxL = Math.max(...logits);
  const exps = logits.map((l) => Math.exp((l - maxL) / Math.max(temperature, 0.01)));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / (sumExps || 1));
}

export class LewisNeuralEngine {
  weights: ModelWeights;
  
  // Fast memoized tables for discrete inputs
  private agentACache: AgentAPrediction[] = [];
  private agentBCache: Map<string, AgentBPrediction> = new Map();

  constructor(weights: ModelWeights) {
    this.weights = weights;
    this.precompute();
  }

  private precompute() {
    // Precompute Agent A for all 8 colors
    for (let c = 0; c < this.weights.n_colors; c++) {
      this.agentACache[c] = this.runAgentARaw(c, 1.0);
    }

    // Precompute Agent B for all 8 shapes and 4 one-hot messages
    for (let s = 0; s < this.weights.n_shapes; s++) {
      for (let t = 0; t < this.weights.vocab_size; t++) {
        const msg = new Array(this.weights.vocab_size).fill(0);
        msg[t] = 1.0;
        const key = `${s}_${t}`;
        this.agentBCache.set(key, this.runAgentBRaw(s, msg));
      }
    }
  }

  // Agent A forward pass: Color -> Token
  runAgentA(color: number, temperature: number = 1.0): AgentAPrediction {
    if (temperature === 1.0 && this.agentACache[color]) {
      return this.agentACache[color];
    }
    return this.runAgentARaw(color, temperature);
  }

  private runAgentARaw(color: number, temperature: number): AgentAPrediction {
    const a = this.weights.agent_a;
    const h = a['color_embed.weight'][color]; // [64]

    // Layer 0: [64, 64] + relu
    const h0 = relu(matvec(a['msg_head.0.weight'], a['msg_head.0.bias'], h));

    // Layer 2: [4, 64]
    const logits = matvec(a['msg_head.2.weight'], a['msg_head.2.bias'], h0);
    const probs = softmax(logits, temperature);

    let maxIdx = 0;
    let maxLogit = logits[0];
    for (let i = 1; i < logits.length; i++) {
      if (logits[i] > maxLogit) {
        maxLogit = logits[i];
        maxIdx = i;
      }
    }

    return { token: maxIdx, logits, probs };
  }

  // Agent B forward pass: Shape + Message vector -> Object prediction
  runAgentB(shape: number, message: number[]): AgentBPrediction {
    // If message is one-hot discrete, check cache
    if (message.length === this.weights.vocab_size) {
      const activeIdx = message.indexOf(1.0);
      const isOneHot = activeIdx !== -1 && message.filter((x) => x === 0).length === message.length - 1;
      if (isOneHot) {
        const key = `${shape}_${activeIdx}`;
        const cached = this.agentBCache.get(key);
        if (cached) return cached;
      }
    }

    return this.runAgentBRaw(shape, message);
  }

  private runAgentBRaw(shape: number, message: number[]): AgentBPrediction {
    const b = this.weights.agent_b;
    const h_shape = b['shape_embed.weight'][shape]; // [64]

    // Message encoder: [64, 4] + relu
    const h_msg = relu(matvec(b['msg_encoder.0.weight'], b['msg_encoder.0.bias'], message));

    // Concat [64 + 64 = 128]
    const concat = [...h_shape, ...h_msg];

    // Decision layer 0: [64, 128] + relu
    const dec0 = relu(matvec(b['decision.0.weight'], b['decision.0.bias'], concat));

    // Decision layer 2: [64, 64]
    const logits = matvec(b['decision.2.weight'], b['decision.2.bias'], dec0);
    const probs = softmax(logits, 1.0);

    let maxIdx = 0;
    let maxVal = logits[0];
    for (let i = 1; i < logits.length; i++) {
      if (logits[i] > maxVal) {
        maxVal = logits[i];
        maxIdx = i;
      }
    }

    const n_shapes = this.weights.n_shapes;
    return {
      predictedTarget: maxIdx,
      predictedColor: Math.floor(maxIdx / n_shapes),
      predictedShape: maxIdx % n_shapes,
      confidence: probs[maxIdx],
      logits,
    };
  }
}
