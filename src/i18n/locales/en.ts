
export const en = {
  common: {
    search: "Search Pet...",
    levels: {
      '0': "Egg",
      '1': "Baby I",
      '2': "Baby II",
      '3': "Child",
      '4': "Adult",
      '5': "Perfect",
      '6': "Ultimate",
      '7': "Ultimate+"
    },
    unseen: {
      attribute: '???',
      name: '???',
      type: '???',
      description: '???',
      move: '???',
      evolution: '???'
    }
  },
  encyclopedia: {
    title: 'Encyclopedia',
    empty: 'Select a pet from the list to see the details.',
    description: 'Description',
    specialMoves: 'Special Moves',
    evolvesFrom: 'Evolves From',
    evolvesTo: 'Available Evolutions',
  },
  evolutionTree: {
    title: 'Evolution Tree'
  },
  statusBar: {
    digivolve: {
      egg:  "{{petName}} opened... it's a {{evolutionName}}!",
      pet:  "{{petName}}, digivolve to... {{evolutionName}}!",
    },
    achievement: "{{achievementName}} unlocked!"
  }
} as const;