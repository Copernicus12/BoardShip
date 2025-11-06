package com.boardship.backend.util;

import lombok.Data;

public class RankingUtil {

    public enum Rank {
        BRONZE("Bronze", 0, 1000, "🥉", "#CD7F32"),
        SILVER("Silver", 1000, 2000, "🥈", "#C0C0C0"),
        GOLD("Gold", 2000, 3000, "🥇", "#FFD700"),
        DIAMOND("Diamond", 3000, 4000, "💎", "#B9F2FF"),
        PLATINUM("Platinum", 4000, Integer.MAX_VALUE, "👑", "#E5E4E2");

        private final String name;
        private final int minRP;
        private final int maxRP;
        private final String icon;
        private final String color;

        Rank(String name, int minRP, int maxRP, String icon, String color) {
            this.name = name;
            this.minRP = minRP;
            this.maxRP = maxRP;
            this.icon = icon;
            this.color = color;
        }

        public String getName() {
            return name;
        }

        public int getMinRP() {
            return minRP;
        }

        public int getMaxRP() {
            return maxRP;
        }

        public String getIcon() {
            return icon;
        }

        public String getColor() {
            return color;
        }
    }

    @Data
    public static class RankInfo {
        private String rank;
        private String icon;
        private String color;
        private int currentRP;
        private int minRP;
        private int maxRP;
        private int progressToNext;
        private String nextRank;
        private int rpToNext;

        public RankInfo(String rank, String icon, String color, int currentRP, int minRP, int maxRP,
                        int progressToNext, String nextRank, int rpToNext) {
            this.rank = rank;
            this.icon = icon;
            this.color = color;
            this.currentRP = currentRP;
            this.minRP = minRP;
            this.maxRP = maxRP;
            this.progressToNext = progressToNext;
            this.nextRank = nextRank;
            this.rpToNext = rpToNext;
        }
    }

    /**
     * Calculate rank information based on ranking points
     */
    public static RankInfo getRankInfo(int rankingPoints) {
        // Ensure RP is not negative
        int rp = Math.max(0, rankingPoints);

        Rank currentRank = Rank.BRONZE;
        for (Rank rank : Rank.values()) {
            if (rp >= rank.minRP && rp < rank.maxRP) {
                currentRank = rank;
                break;
            }
        }

        // Calculate progress to next rank
        int rangeSize = currentRank.maxRP - currentRank.minRP;
        int progressInCurrentRank = rp - currentRank.minRP;
        int progressPercentage = rangeSize == Integer.MAX_VALUE ? 100 :
                                 (int) ((double) progressInCurrentRank / rangeSize * 100);

        // Get next rank info
        String nextRankName = null;
        int rpToNext = 0;

        if (currentRank != Rank.PLATINUM) {
            Rank[] ranks = Rank.values();
            for (int i = 0; i < ranks.length - 1; i++) {
                if (ranks[i] == currentRank) {
                    nextRankName = ranks[i + 1].name;
                    rpToNext = ranks[i + 1].minRP - rp;
                    break;
                }
            }
        }

        return new RankInfo(
            currentRank.name,
            currentRank.icon,
            currentRank.color,
            rp,
            currentRank.minRP,
            currentRank.maxRP == Integer.MAX_VALUE ? currentRank.minRP : currentRank.maxRP,
            progressPercentage,
            nextRankName,
            rpToNext
        );
    }

    /**
     * Calculate RP gain/loss for a match
     */
    public static int calculateRPChange(boolean isWinner, int playerRP, int opponentRP) {
        if (isWinner) {
            // Base win points: 20-30 based on rank difference
            int basePoints = 25;
            int rankDiff = opponentRP - playerRP;

            // Bonus for beating higher ranked player
            if (rankDiff > 0) {
                basePoints += Math.min(rankDiff / 100, 10); // Up to +10 bonus
            } else if (rankDiff < 0) {
                // Less points for beating lower ranked player
                basePoints += Math.max(rankDiff / 100, -10); // Down to -10 penalty
            }

            return Math.max(5, basePoints); // Minimum 5 RP gain
        } else {
            // Base loss points: -15 to -25 based on rank difference
            int basePoints = -20;
            int rankDiff = opponentRP - playerRP;

            // Lose less RP when losing to higher ranked player
            if (rankDiff > 0) {
                basePoints += Math.min(rankDiff / 100, 10); // Up to -10 RP
            } else if (rankDiff < 0) {
                // Lose more RP when losing to lower ranked player
                basePoints += Math.max(rankDiff / 100, -10); // Down to -30 RP
            }

            return Math.max(-30, basePoints); // Maximum 30 RP loss
        }
    }
}

