import json
import os
import random
import numpy as np
import sys

STATE_FILE = "./api/src/bandit_state.json"


class EpsilonGreedyBandit:
    def __init__(self, n_arms, epsilon=0.1):
        self.n_arms = n_arms
        self.epsilon = epsilon
        self.counts = [0] * n_arms
        self.values = [0.0] * n_arms

    def select_arm(self):
        if random.random() < self.epsilon:
            return random.randint(0, self.n_arms - 1)
        else:
            return int(np.argmax(self.values))

    def update(self, chosen_arm, reward):
        self.counts[chosen_arm] += 1
        n = self.counts[chosen_arm]
        old_value = self.values[chosen_arm]
        new_value = ((n - 1) / n) * old_value + (1 / n) * reward
        self.values[chosen_arm] = new_value

    def to_dict(self):
        return {
            "n_arms": self.n_arms,
            "epsilon": self.epsilon,
            "counts": self.counts,
            "values": self.values,
        }

    @staticmethod
    def from_dict(data):
        b = EpsilonGreedyBandit(data["n_arms"], data["epsilon"])
        b.counts = data["counts"]
        b.values = data["values"]
        return b


def load_bandit(n_arms, epsilon=0.1):
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            data = json.load(f)
        if data["n_arms"] != n_arms:
            # обнуляем, если изменилось количество участников
            return EpsilonGreedyBandit(n_arms, epsilon)
        return EpsilonGreedyBandit.from_dict(data)
    return EpsilonGreedyBandit(n_arms, epsilon)


def save_bandit(bandit):
    with open(STATE_FILE, "w") as f:
        json.dump(bandit.to_dict(), f, indent=2)


if __name__ == "__main__":
    # usage:
    # python recommendation_bandit.py select <n_arms>
    # python recommendation_bandit.py update <n_arms> <chosen_arm> <reward>

    if len(sys.argv) < 3:
        print("Usage: python recommendation_bandit.py <select|update> <n_arms> [chosen_arm reward]")
        sys.exit(1)

    mode = sys.argv[1]
    n_arms = int(sys.argv[2])
    bandit = load_bandit(n_arms)

    if mode == "select":
        chosen = bandit.select_arm()
        save_bandit(bandit)
        print(chosen)

    elif mode == "update":
        if len(sys.argv) != 5:
            print("Usage: python recommendation_bandit.py update <n_arms> <chosen_arm> <reward>")
            sys.exit(1)
        chosen_arm = int(sys.argv[3])
        reward = float(sys.argv[4])
        bandit.update(chosen_arm, reward)
        save_bandit(bandit)
        print("updated")

    else:
        print("Invalid mode")
        sys.exit(1)
