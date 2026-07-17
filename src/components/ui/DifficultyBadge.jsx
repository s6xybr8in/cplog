import { DIFFICULTY_TIER_BADGE } from '../../constants'
import { cn, getDifficultyTier } from '../../lib/utils'

function DifficultyBadge({ difficulty }) {
  if (!difficulty) return null
  const tier = getDifficultyTier(difficulty)
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold', DIFFICULTY_TIER_BADGE[tier])}>
      {difficulty}
    </span>
  )
}

export { DifficultyBadge }
