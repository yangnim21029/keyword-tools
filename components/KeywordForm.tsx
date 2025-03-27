import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { KeywordFormData, RegionOption, LanguageOption } from '@/types';

interface KeywordFormProps {
  onSubmit: (data: KeywordFormData) => void;
  isLoading: boolean;
  regions: RegionOption[];
}

const LANGUAGES: LanguageOption[] = [
  { name: '繁體中文', code: 'zh-TW' },
  { name: '簡體中文', code: 'zh-CN' },
  { name: '英文', code: 'en-US' },
  { name: '日文', code: 'ja-JP' },
  { name: '韓文', code: 'ko-KR' },
];

const KeywordForm: React.FC<KeywordFormProps> = ({ onSubmit, isLoading, regions }) => {
  const [useAlphabet, setUseAlphabet] = useState<boolean>(true);
  const [useSymbols, setUseSymbols] = useState<boolean>(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<KeywordFormData>({
    defaultValues: {
      query: '',
      region: 'TW',
      language: 'zh-TW',
    }
  });

  const processSubmit: SubmitHandler<KeywordFormData> = (data) => {
    // Add the alphabet and symbols options to the data
    const enhancedData = {
      ...data, 
      useAlphabet,
      useSymbols
    };
    onSubmit(enhancedData);
  };

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-6">
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text text-lg">主要關鍵詞</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className={`input input-bordered w-full pl-10 ${errors.query ? 'input-error' : ''}`}
            placeholder="輸入想要研究的關鍵詞"
            {...register('query', { required: '關鍵詞是必填的' })}
          />
        </div>
        {errors.query && <span className="text-error text-sm mt-1">{errors.query.message}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text text-lg">地區</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <select
              className="select select-bordered w-full pl-10"
              {...register('region')}
            >
              {regions.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text text-lg">語言</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <select
              className="select select-bordered w-full pl-10"
              {...register('language')}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name} ({language.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 mt-4">
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-2">
            <input 
              type="checkbox" 
              className="checkbox checkbox-sm"
              checked={useAlphabet}
              onChange={() => setUseAlphabet(!useAlphabet)}
            />
            <span className="label-text">使用字母擴展查詢 (a-z)</span>
          </label>
        </div>
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-2">
            <input 
              type="checkbox" 
              className="checkbox checkbox-sm"
              checked={useSymbols}
              onChange={() => setUseSymbols(!useSymbols)}
            />
            <span className="label-text">使用符號擴展查詢 (?, !, :, 等)</span>
          </label>
        </div>
      </div>

      <div className="mt-8">
        <button
          type="submit"
          className={`btn btn-primary w-full ${isLoading ? 'btn-disabled' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <span className="loading loading-spinner loading-sm mr-2"></span>
              處理中...
            </span>
          ) : '獲取關鍵詞建議'}
        </button>
        <p className="text-xs text-base-content/70 mt-2 text-center">
          點擊按鈕後，系統將從 Google 獲取關鍵詞建議並分析搜尋量數據。
        </p>
      </div>
    </form>
  );
};

export default KeywordForm; 