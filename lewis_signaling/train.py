"""
Two-phase training loop for the Lewis Game.

Phase 1 — Warm-up (bottlenecked SFT)
    AgentA receives a 'hint': a one-hot vector encoding the full object identity.
    It must compress ALL information through msg_len abstract tokens before
    passing to AgentB.  AgentB sees ONLY the tokens — never the hint.
    This is the information bottleneck: the tokens must learn to carry meaning.

Phase 2 — Fine-tune (distillation)
    The hint is removed.  AgentA now generates tokens from its color observation
    alone, relying on representations built during Phase 1.

This mirrors Abstract-CoT (Ramji et al. 2026, arXiv:2604.22709):
    Bottlenecked SFT  ≈  Phase 1
    Self-distillation ≈  Phase 2

Temperature annealing:
    τ is annealed exponentially from temp_start → temp_end over training.
    High τ  → soft tokens   (good for gradient flow early in training)
    Low  τ  → hard tokens   (approaches true discrete communication)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim

from .env import LewisGame
from .agents import AgentA, AgentB


def train(
    n_epochs: int = 600,
    batch_size: int = 256,
    n_colors: int = 8,
    n_shapes: int = 8,
    vocab_size: int = 4,
    msg_len: int = 1,
    hidden: int = 64,
    lr: float = 1e-3,
    warmup_epochs: int = 300,
    temp_start: float = 2.0,
    temp_end: float = 0.3,
    log_every: int = 20,
):
    """
    Train AgentA and AgentB on the Lewis Signaling Game.

    Args:
        n_epochs      : total training epochs
        batch_size    : games per gradient step
        n_colors      : grid width (Agent A's observation space)
        n_shapes      : grid height (Agent B's observation space)
        vocab_size    : discrete vocabulary size
        msg_len       : tokens per message
        hidden        : MLP hidden width
        lr            : Adam learning rate
        warmup_epochs : epochs with hint enabled (Phase 1)
        temp_start    : initial Gumbel temperature
        temp_end      : final Gumbel temperature
        log_every     : print interval

    Returns:
        agent_a : trained AgentA
        agent_b : trained AgentB
        history : dict with keys epoch, loss, acc, phase
        game    : LewisGame instance (for eval)
    """
    game = LewisGame(n_colors=n_colors, n_shapes=n_shapes)
    agent_a = AgentA(game.n_colors, game.n_objects, vocab_size, msg_len, hidden)
    agent_b = AgentB(game.n_shapes, game.n_objects, vocab_size, msg_len, hidden)
    params = list(agent_a.parameters()) + list(agent_b.parameters())
    opt = optim.Adam(params, lr=lr)

    history: dict[str, list] = {"epoch": [], "loss": [], "acc": [], "phase": []}

    for epoch in range(n_epochs):
        # exponential temperature annealing
        t = epoch / max(n_epochs - 1, 1)
        temperature = temp_start * (temp_end / temp_start) ** t

        targets, colors, shapes = game.sample(batch_size)

        # Phase 1: bottlenecked warm-up
        if epoch < warmup_epochs:
            hint = F.one_hot(targets, game.n_objects).float()
            msg, _ = agent_a(colors, hint=hint, temperature=temperature)
            phase = "warmup"
        # Phase 2: distillation (no hint)
        else:
            msg, _ = agent_a(colors, hint=None, temperature=temperature)
            phase = "finetune"

        loss = F.cross_entropy(agent_b(shapes, msg), targets)
        opt.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(params, max_norm=1.0)
        opt.step()

        if epoch % log_every == 0:
            with torch.no_grad():
                m, _ = agent_a(colors, hint=None, temperature=0.1, hard=True)
                preds = agent_b(shapes, m).argmax(dim=-1)
                acc = game.accuracy(targets, preds)

            history["epoch"].append(epoch)
            history["loss"].append(loss.item())
            history["acc"].append(acc)
            history["phase"].append(phase)

            print(
                f"[{phase:8s}] ep {epoch:4d} | "
                f"loss {loss.item():.3f} | acc {acc:.3f} | temp {temperature:.2f}"
            )

    return agent_a, agent_b, history, game
