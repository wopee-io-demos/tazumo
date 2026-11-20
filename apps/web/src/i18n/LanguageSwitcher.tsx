import {languageNames,languages,t,type Language} from '@tazumo/core';

export function LanguageSwitcher({lang,onChange}:{lang:Language;onChange:(lang:Language)=>void}){
  return <div className="languageSwitcher">
    <label htmlFor="language"><span aria-hidden="true">🌐 </span><span className="languageLabel">{t(lang,'language')}</span></label>
    <select id="language" data-testid="sut-language" value={lang} onChange={e=>onChange(e.target.value as Language)}>
      {languages.map(x=><option key={x} value={x} lang={x}>{languageNames[x]}</option>)}
    </select>
  </div>;
}
