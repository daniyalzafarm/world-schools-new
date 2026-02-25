import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

/**
 * Validator to ensure a date is in the future
 */
@ValidatorConstraint({ name: 'isDateInFuture', async: false })
export class IsDateInFutureConstraint implements ValidatorConstraintInterface {
  validate(dateString: string, args: ValidationArguments) {
    if (!dateString) return false

    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return date > today
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a date in the future`
  }
}

export function IsDateInFuture(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDateInFutureConstraint,
    })
  }
}

/**
 * Validator to ensure validUntil is after validFrom
 */
@ValidatorConstraint({ name: 'isDateAfter', async: false })
export class IsDateAfterConstraint implements ValidatorConstraintInterface {
  validate(validUntil: string, args: ValidationArguments) {
    if (!validUntil) return false

    const object = args.object as any
    const validFrom = object.validFrom

    if (!validFrom) return true // If validFrom is not set, we can't compare

    const dateFrom = new Date(validFrom)
    const dateUntil = new Date(validUntil)

    return dateUntil > dateFrom
  }

  defaultMessage(args: ValidationArguments) {
    return 'validUntil must be after validFrom'
  }
}

export function IsDateAfter(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDateAfterConstraint,
    })
  }
}

/**
 * Validator for alphanumeric strings (promo codes)
 */
@ValidatorConstraint({ name: 'isAlphanumeric', async: false })
export class IsAlphanumericConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    if (!value) return false
    return /^[A-Z0-9]+$/.test(value)
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must contain only uppercase letters and numbers`
  }
}

export function IsAlphanumeric(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAlphanumericConstraint,
    })
  }
}

/**
 * Validator to ensure sibling discount tiers are in ascending order
 */
@ValidatorConstraint({ name: 'isSiblingTiersValid', async: false })
export class IsSiblingTiersValidConstraint implements ValidatorConstraintInterface {
  validate(config: any, args: ValidationArguments) {
    if (!config) return false

    const { secondChild, thirdChild, fourthPlusChild } = config

    if (secondChild === undefined || thirdChild === undefined || fourthPlusChild === undefined) {
      return false
    }

    // Each tier should be >= previous tier
    return thirdChild >= secondChild && fourthPlusChild >= thirdChild
  }

  defaultMessage(args: ValidationArguments) {
    return 'Sibling discount tiers must be in ascending order (thirdChild >= secondChild, fourthPlusChild >= thirdChild)'
  }
}

export function IsSiblingTiersValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSiblingTiersValidConstraint,
    })
  }
}
