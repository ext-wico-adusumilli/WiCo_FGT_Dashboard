import { useTheme } from '../../contexts/ThemeContext';

export type MTTFCategory = 
  | 'structure' 
  | 'propulsion' 
  | 'actuators' 
  | 'controller' 
  | 'communication';

interface MTTFCategoryNavProps {
  activeCategory: MTTFCategory;
  onCategoryChange: (category: MTTFCategory) => void;
}

interface CategoryItem {
  id: MTTFCategory;
  label: string;
}

export function MTTFCategoryNav({ activeCategory, onCategoryChange }: MTTFCategoryNavProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const categories: CategoryItem[] = [
    { id: 'structure', label: 'Structure/Airframe' },
    { id: 'propulsion', label: 'Propulsion System' },
    { id: 'actuators', label: 'Actuators (Tilt and Control Surface)' },
    { id: 'controller', label: 'Controller and Sensor' },
    { id: 'communication', label: 'Communication Unit' },
  ];

  return (
    <div className={`border rounded-lg overflow-hidden w-full ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
    }`}>
      <div className={`flex overflow-x-auto -mx-0.5 ${
        isDark ? 'scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800' : 'scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100'
      }`}>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`flex-shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium transition whitespace-nowrap ${
              activeCategory === category.id
                ? isDark 
                  ? 'bg-[#3EC1C5] text-gray-900 border-b-2 border-[#3EC1C5]'
                  : 'bg-gray-900 text-white border-b-2 border-gray-900'
                : isDark 
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white border-b-2 border-transparent'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-b-2 border-transparent'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}

