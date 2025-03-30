import { LoadingButton } from "@/components/ui/loading-button";
import { LanguageOption, RegionOption, UrlFormData } from '@/types';
import { useForm } from 'react-hook-form';

interface UrlFormProps {
  onSubmit: (data: UrlFormData) => void;
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

const UrlForm: React.FC<UrlFormProps> = ({ onSubmit, isLoading, regions }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<UrlFormData>({
    defaultValues: {
      url: '',
      region: 'TW',
      language: 'zh-TW',
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text text-lg">網址 (URL)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <input
            type="url"
            className={`input input-bordered w-full pl-10 ${errors.url ? 'input-error' : ''}`}
            placeholder="輸入要分析的網址 (例如: https://example.com)"
            {...register('url', { 
              required: '網址是必填的',
              pattern: {
                value: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/,
                message: '請輸入有效的網址'
              }
            })}
          />
        </div>
        {errors.url && <span className="text-error text-sm mt-1">{errors.url.message}</span>}
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

      <div className="mt-8">
        <LoadingButton
          type="submit"
          className="w-full"
          variant="default"
          isLoading={isLoading}
          loadingText="處理中..."
        >
          分析網頁關鍵詞
        </LoadingButton>
        <p className="text-xs text-base-content/70 mt-2 text-center">
          點擊按鈕後，系統將抓取網頁內容，擷取可能的關鍵詞並分析搜尋量數據。
        </p>
      </div>
    </form>
  );
};

export default UrlForm; 