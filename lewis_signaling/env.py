"""
Lewis Signaling Game environment.

Two agents have PARTIAL information about a shared target object:
  - Agent A observes the COLOR of the target  (0 … n_colors-1)
  - Agent B observes the SHAPE of the target  (0 … n_shapes-1)
  - Together they must identify the object    (0 … n_objects-1)

Neither agent can solve the task alone — communication is required.

Information theory:
  Random baseline = 1 / n_objects
  Easy (4×4): 1/16  = 6.25%   |  6 bits capacity > 4 bits needed  -> trivial
  Hard (8×8): 1/64  = 1.56%   |  2 bits capacity < 6 bits needed  -> hard
"""

import torch


class LewisGame:
    """
    Lewis Signaling Game with configurable grid size.

    Objects are laid out on a (n_colors × n_shapes) grid,
    encoded as flat indices: target = color * n_shapes + shape.

    Args:
        n_colors: number of distinct colors Agent A can observe
        n_shapes: number of distinct shapes Agent B can observe
    """

    def __init__(self, n_colors: int = 4, n_shapes: int = 4):
        self.n_colors = n_colors
        self.n_shapes = n_shapes
        self.n_objects = n_colors * n_shapes

    def sample(self, batch_size: int = 256):
        """
        Sample a batch of games.

        Returns:
            targets : (B,) long — ground truth object index
            colors  : (B,) long — Agent A's observation (color)
            shapes  : (B,) long — Agent B's observation (shape)
        """
        targets = torch.randint(0, self.n_objects, (batch_size,))
        colors = targets // self.n_shapes
        shapes = targets % self.n_shapes
        return targets, colors, shapes

    def accuracy(self, targets: torch.Tensor, predictions: torch.Tensor) -> float:
        """Fraction of correctly identified objects."""
        return (predictions == targets).float().mean().item()

    def random_baseline(self) -> float:
        """Expected accuracy of a random agent: 1/n_objects."""
        return 1.0 / self.n_objects

    def __repr__(self) -> str:
        return (
            f"LewisGame(n_colors={self.n_colors}, n_shapes={self.n_shapes}, "
            f"n_objects={self.n_objects}, random_baseline={self.random_baseline():.4f})"
        )


if __name__ == "__main__":
    for nc, ns in [(4, 4), (8, 8)]:
        game = LewisGame(nc, ns)
        t, _, _ = game.sample(10_000)
        rand = torch.randint(0, game.n_objects, (10_000,))
        print(f"{nc}×{ns}: random baseline = {game.accuracy(t, rand):.4f}  {game}")
