<?php
namespace App\Services;

/**
 * Game rewards: XP, coins, levels and card rarity. All values derive from a validated play log.
 * Keep the numbers in sync with frontend/utils/game.ts (ENERGY) and frontend/utils/progression.ts.
 */
class Progression
{
    public const XP_CHOICE = 10;
    public const XP_WIN = 30;
    public const XP_FAIL = 15;       // effort still counts
    public const XP_QUEST_BONUS = 100;
    public const COINS_PER_ITEM = 20;
    public const COINS_QUEST_BONUS = 50;

    /** @param array{choices:int, wins:int, fails:int} $stats */
    public static function rewards(array $stats, int $itemCount): array
    {
        return [
            'xp' => $stats['choices'] * self::XP_CHOICE + $stats['wins'] * self::XP_WIN
                + $stats['fails'] * self::XP_FAIL + self::XP_QUEST_BONUS,
            'coins' => $itemCount * self::COINS_PER_ITEM + self::COINS_QUEST_BONUS,
        ];
    }

    /** Level L -> L+1 needs 100 + 50(L-1) XP. */
    public static function level(int $xp): array
    {
        $level = 1;
        $need = 100;
        while ($xp >= $need) {
            $xp -= $need;
            $level++;
            $need = 100 + 50 * ($level - 1);
        }
        return ['level' => $level, 'xp_into_level' => $xp, 'xp_for_next' => $need];
    }

    /**
     * Quest card: rare, or epic when every mini-game in the run was cleared.
     * No student ever gets a "low" tier — rarity rewards engagement, not personality.
     */
    public static function questRarity(array $stats): string
    {
        return $stats['wins'] > 0 && $stats['fails'] === 0 ? 'epic' : 'rare';
    }

    /** Core Profile: grows with the share of universal quests completed. */
    public static function coreRarity(int $completed, int $total): string
    {
        if ($total > 0 && $completed >= $total) {
            return 'legendary';
        }
        return $completed >= 2 ? 'epic' : 'rare';
    }
}
