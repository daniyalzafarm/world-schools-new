export const PREDEFINED_TRANSPORT = [
  { id: 'airport-pickup', name: 'Airport Pickup', icon: '✈️' },
  { id: 'bus-service', name: 'Bus Service', icon: '🚌' },
  { id: 'train-station', name: 'Train Station Pickup', icon: '🚂' },
  { id: 'shuttle', name: 'Shuttle Service', icon: '🚐' },
  { id: 'private-transfer', name: 'Private Transfer', icon: '🚗' },
  { id: 'group-transport', name: 'Group Transport', icon: '🚌' },
]

export const TRANSPORT_INCLUDED = [
  {
    value: 'all',
    label: 'All Included',
    description: 'Transportation for all trips included in camp fee',
  },
  {
    value: 'some',
    label: 'Some Included',
    description: 'Major transportation included, some additional cost',
  },
  {
    value: 'none',
    label: 'Not Included',
    description: 'Families arrange and pay for own transportation',
  },
]

export const PICKUP_LOCATIONS = [
  {
    value: 'single',
    label: 'Single Location',
    description: 'One central pickup/drop-off point',
  },
  {
    value: 'multiple',
    label: 'Multiple Locations',
    description: 'Several pickup/drop-off points available',
  },
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'Can arrange custom pickup locations',
  },
]
