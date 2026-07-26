import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type AttributeValues,
} from './model'

export interface SeededVariationSelection {
  positiveAttribute: AttributeKey
  negativeAttribute: AttributeKey
}

export function selectSeededVariationAttributes(
  attributes: Readonly<AttributeValues>,
): SeededVariationSelection {
  const byAscendingValue = [...ATTRIBUTE_KEYS].sort((left, right) => {
    const difference = attributes[left] - attributes[right]
    return difference === 0
      ? ATTRIBUTE_KEYS.indexOf(left) - ATTRIBUTE_KEYS.indexOf(right)
      : difference
  })
  const negativeAttribute =
    byAscendingValue.find((attribute) => attributes[attribute] >= 5) ??
    byAscendingValue[byAscendingValue.length - 1]
  const positiveAttribute =
    [...ATTRIBUTE_KEYS]
      .filter(
        (attribute) =>
          attribute !== negativeAttribute && attributes[attribute] < 8,
      )
      .sort((left, right) => {
        const difference = attributes[right] - attributes[left]
        return difference === 0
          ? ATTRIBUTE_KEYS.indexOf(left) - ATTRIBUTE_KEYS.indexOf(right)
          : difference
      })[0] ?? byAscendingValue[1]

  return { positiveAttribute, negativeAttribute }
}
