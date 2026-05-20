"""
Neural agents for the Lewis Signaling Game.

AgentA (Speaker / Sender)
    Encodes its COLOR observation into a discrete message via Gumbel-Softmax.
    During warm-up it also receives a 'hint' (full object one-hot) that it must
    compress through the same bottleneck — this seeds the token embeddings with
    meaning before the hint is removed.

AgentB (Listener / Receiver)
    Decodes the message together with its own SHAPE observation to predict
    the target object.

Gumbel-Softmax recap:
    Discrete argmax is not differentiable, so gradients cannot flow through it.
    Gumbel-Softmax approximates the discrete distribution in a differentiable
    way by adding Gumbel noise and dividing by temperature τ:
        z_k = softmax( (log π_k + g_k) / τ )
    High τ  → soft distribution (easy gradient flow, not very discrete)
    Low  τ  → near one-hot    (hard to train early, very discrete at inference)
    I have anneal τ from 2.0 → 0.3 over training.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class AgentA(nn.Module):
    """
    Speaker agent.  Converts color observation → discrete message.

    Args:
        n_colors   : number of distinct colors
        n_objects  : total number of objects (= n_colors × n_shapes)
        vocab_size : number of discrete token types in the vocabulary
        msg_len    : number of tokens per message
        hidden     : hidden layer width
    """

    def __init__(
        self,
        n_colors: int,
        n_objects: int,
        vocab_size: int = 8,
        msg_len: int = 2,
        hidden: int = 64,
    ):
        super().__init__()
        self.vocab_size = vocab_size
        self.msg_len = msg_len

        self.color_embed = nn.Embedding(n_colors, hidden)
        # hint_encoder is only active during warm-up; weights stay for fine-tune
        self.hint_encoder = nn.Linear(n_objects, hidden, bias=False)
        self.msg_head = nn.Sequential(
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, vocab_size * msg_len),
        )

    def forward(
        self,
        color_obs: torch.Tensor,
        hint: torch.Tensor | None = None,
        temperature: float = 1.0,
        hard: bool = False,
    ):
        """
        Args:
            color_obs   : (B,) long — color index
            hint        : (B, n_objects) float one-hot, or None
            temperature : Gumbel-Softmax temperature (annealed during training)
            hard        : if True, straight-through one-hot (use at eval time)

        Returns:
            message : (B, msg_len, vocab_size)  soft or hard token distribution
            logits  : (B, msg_len, vocab_size)  raw scores before Gumbel
        """
        h = self.color_embed(color_obs)
        if hint is not None:
            h = h + self.hint_encoder(hint)  # bottleneck: blend color + hint

        logits = self.msg_head(h).view(-1, self.msg_len, self.vocab_size)
        message = F.gumbel_softmax(logits, tau=temperature, hard=hard, dim=-1)
        return message, logits


class AgentB(nn.Module):
    """
    Listener agent.  Combines shape observation + message → object prediction.

    Args:
        n_shapes   : number of distinct shapes
        n_objects  : total number of objects
        vocab_size : must match AgentA's vocab_size
        msg_len    : must match AgentA's msg_len
        hidden     : hidden layer width
    """

    def __init__(
        self,
        n_shapes: int,
        n_objects: int,
        vocab_size: int = 8,
        msg_len: int = 2,
        hidden: int = 64,
    ):
        super().__init__()
        self.shape_embed = nn.Embedding(n_shapes, hidden)
        self.msg_encoder = nn.Sequential(
            nn.Linear(vocab_size * msg_len, hidden),
            nn.ReLU(),
        )
        self.decision = nn.Sequential(
            nn.Linear(hidden * 2, hidden),
            nn.ReLU(),
            nn.Linear(hidden, n_objects),
        )

    def forward(self, shape_obs: torch.Tensor, message: torch.Tensor):
        """
        Args:
            shape_obs : (B,) long — shape index
            message   : (B, msg_len, vocab_size) from AgentA

        Returns:
            logits : (B, n_objects) — unnormalized object scores
        """
        h_shape = self.shape_embed(shape_obs)
        msg_flat = message.view(message.size(0), -1)
        h_msg = self.msg_encoder(msg_flat)
        return self.decision(torch.cat([h_shape, h_msg], dim=-1))


if __name__ == "__main__":
    # quick shape sanity check
    a = AgentA(n_colors=8, n_objects=64, vocab_size=4, msg_len=1)
    b = AgentB(n_shapes=8, n_objects=64, vocab_size=4, msg_len=1)
    colors = torch.randint(0, 8, (4,))
    shapes = torch.randint(0, 8, (4,))
    msg, _ = a(colors)
    out = b(shapes, msg)
    assert list(msg.shape) == [4, 1, 4], f"Bad msg shape: {msg.shape}"
    assert list(out.shape) == [4, 64], f"Bad out shape: {out.shape}"
    print("AgentA + AgentB forward pass OK")
