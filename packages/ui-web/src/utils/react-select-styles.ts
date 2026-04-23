import type { ClassNamesConfig, GroupBase, StylesConfig } from 'react-select'

/**
 * Tailwind classNames for react-select that match the look of `SelectField`
 * (white bg, gray-200 border, primary border on focus/open, rounded-lg,
 * capitalize items). Pair with `unstyled` on the Select component.
 */
export function selectFieldClassNames<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(): ClassNamesConfig<Option, IsMulti, Group> {
  return {
    control: state =>
      [
        'min-h-10 cursor-pointer rounded-lg bg-white capitalize',
        'border border-gray-200 hover:border-gray-300',
        state.isFocused || state.menuIsOpen ? '!border-primary' : '',
        'dark:bg-gray-900 dark:border-gray-600',
      ].join(' '),
    valueContainer: () => 'gap-1 px-3 py-1',
    placeholder: () => 'text-gray-400 dark:text-gray-500 text-sm',
    input: () => 'text-sm text-gray-900 dark:text-gray-100',
    singleValue: () => 'text-sm text-gray-900 dark:text-gray-100',
    multiValue: () => 'bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden',
    multiValueLabel: () => 'text-slate-700 dark:text-slate-300 text-sm font-medium px-2 py-0.5',
    multiValueRemove: () =>
      'px-1 text-slate-500 hover:text-slate-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer',
    indicatorsContainer: () => 'pe-2',
    indicatorSeparator: () => 'hidden',
    dropdownIndicator: () =>
      'text-gray-500 hover:text-gray-700 dark:text-gray-400 px-1 cursor-pointer',
    clearIndicator: () =>
      'text-gray-500 hover:text-gray-700 dark:text-gray-400 px-1 cursor-pointer',
    menu: () =>
      'mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden',
    menuList: () => 'py-1 max-h-60 overflow-auto',
    option: state =>
      [
        'cursor-pointer px-3 py-2 text-sm capitalize',
        state.isFocused ? 'bg-gray-100 dark:bg-gray-700' : '',
        state.isSelected
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-gray-900 dark:text-gray-100',
      ].join(' '),
    noOptionsMessage: () => 'px-3 py-2 text-sm text-gray-500',
  }
}

/**
 * Pair with `menuPortalTarget={document.body}` so the menu floats above
 * any parent stacking context (e.g. inside accordions, scrollable containers).
 */
export function selectFieldPortalStyles<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(): StylesConfig<Option, IsMulti, Group> {
  return {
    menuPortal: base => ({ ...base, zIndex: 9999 }),
  }
}
