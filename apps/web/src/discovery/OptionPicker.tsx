import {t,type Language} from '@tazumo/core';
import type {OptionsError,ProductOptions,Selection} from '@tazumo/product-options';
import {formatDelta,optionLabel} from './options';

type Props={lang:Language;definition:ProductOptions;selection:Selection;errors:OptionsError[];onChange:(selection:Selection)=>void};

export function OptionPicker({lang,definition,selection,errors,onChange}:Props){
  const set=(groupId:string,ids:string[])=>onChange({...selection,[groupId]:ids});
  const message=(error:OptionsError)=>{
    const group=definition.groups.find(g=>g.id===error.path[1]);
    return error.code==='too_many_options'&&group?`${optionLabel(lang,group.labelKey)}: ${t(lang,'chooseUpTo').replace('{max}',String(group.max))}`:t(lang,'optionsInvalid');
  };
  return <div className="optionPicker">
    {definition.groups.map(group=>{
      const chosen=selection[group.id]??[],single=group.selection==='single';
      return <fieldset key={group.id} className="optionGroup" data-testid={`sut-option-group-${group.id}`}>
        <legend>{optionLabel(lang,group.labelKey)}{!single&&<span className="optionHint"> · {t(lang,'chooseUpTo').replace('{max}',String(group.max))}</span>}</legend>
        {single&&!group.required&&<label><input type="radio" name={`option-${group.id}`} data-testid={`sut-option-none-${group.id}`} checked={chosen.length===0} onChange={()=>set(group.id,[])}/> {t(lang,'optionNone')}</label>}
        {group.options.map(option=><label key={option.id} className={option.available?undefined:'optionUnavailable'}>
          <input type={single?'radio':'checkbox'} name={`option-${group.id}`} data-testid={`sut-option-${option.id}`} disabled={!option.available} checked={chosen.includes(option.id)}
            onChange={e=>set(group.id,single?[option.id]:group.options.filter(o=>o.id===option.id?e.target.checked:chosen.includes(o.id)).map(o=>o.id))}/>
          {' '}{optionLabel(lang,option.labelKey)}
          {option.priceDeltaMinor!==0&&<span className="optionDelta"> {formatDelta(option.priceDeltaMinor,lang)}</span>}
          {!option.available&&<span> ({t(lang,'optionUnavailable')})</span>}
        </label>)}
      </fieldset>;
    })}
    {errors.length>0&&<p role="alert" className="optionsError" data-testid="sut-options-error">{[...new Set(errors.map(message))].join(' ')}</p>}
  </div>;
}
