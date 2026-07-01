export const countries = [
  { name: 'Global', flag: '🌎' },
  { name: 'India', flag: '🇮🇳' },
  { name: 'USA', flag: '🇺🇸' },
  { name: 'Brazil', flag: '🇧🇷' },
  { name: 'Russia', flag: '🇷🇺' },
  { name: 'Turkey', flag: '🇹🇷' },
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'UAE', flag: '🇦🇪' },
  { name: 'UK', flag: '🇬🇧' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'South Korea', flag: '🇰🇷' },
  { name: 'Italy', flag: '🇮🇹' },
  { name: 'Spain', flag: '🇪🇸' },
  { name: 'Mexico', flag: '🇲🇽' },
  { name: 'Indonesia', flag: '🇮🇩' },
  { name: 'Vietnam', flag: '🇻🇳' },
  { name: 'Thailand', flag: '🇹🇭' },
  { name: 'Philippines', flag: '🇵🇭' },
  { name: 'Saudi Arabia', flag: '🇸🇦' },
  { name: 'Egypt', flag: '🇪🇬' },
  { name: 'Nigeria', flag: '🇳🇬' },
  { name: 'South Africa', flag: '🇿🇦' },
  { name: 'Argentina', flag: '🇦🇷' },
];

export const getFlag = (countryName: string) => {
  return countries.find(c => c.name === countryName)?.flag || '🌎';
};
