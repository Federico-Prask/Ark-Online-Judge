import * as freeSolid from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

// 支持模板写法：<FontAwesomeIcon :icon="byPrefixAndName.fas['users-gear']" />
export const byPrefixAndName: { fas: Record<string, IconDefinition> } = { fas: {} }
for (const v of Object.values(freeSolid)) {
  const d = v as unknown as IconDefinition
  if (d && typeof d === 'object' && 'iconName' in d) byPrefixAndName.fas[d.iconName] = d
}
