import {useEffect,useRef} from 'react';
import {t,type Language} from '@tazumo/core';
import {homeHref} from './route';

export function useRouteFocus(key:string){
  const ref=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{ref.current?.focus();},[key]);
  return ref;
}

export function Breadcrumbs({lang,trail}:{lang:Language;trail:{label:string;href?:string}[]}){
  return <nav aria-label={t(lang,'breadcrumb')} className="breadcrumbs"><ol>
    <li><a href={homeHref} data-testid="sut-breadcrumb-home">{t(lang,'home')}</a></li>
    {trail.map((item,i)=><li key={i}>{item.href?<a href={item.href}>{item.label}</a>:<span aria-current="page">{item.label}</span>}</li>)}
  </ol></nav>;
}

export function NotFound({lang,routeKey,message,testId}:{lang:Language;routeKey:string;message:string;testId:string}){
  const heading=useRouteFocus(routeKey);
  return <section className="detail notFound" data-testid={testId}>
    <h1 ref={heading} tabIndex={-1}>{message}</h1>
    <a className="detailBack" href={homeHref} data-testid="sut-back-to-merchants">← {t(lang,'backToMerchants')}</a>
  </section>;
}

type StepperProps={lang:Language;name:string;idKey:string;quantity:number;testIdPrefix:string;onChange:(delta:number)=>void;onRemove:()=>void};
export function QuantityStepper({lang,name,idKey,quantity,testIdPrefix,onChange,onRemove}:StepperProps){
  return <div className="stepper" role="group" aria-label={`${t(lang,'quantity')}: ${name}`}>
    <button type="button" data-testid={`${testIdPrefix}-decrease-${idKey}`} aria-label={`${t(lang,'removeOne')} ${name}`} onClick={()=>onChange(-1)}>−</button>
    <span data-testid={`${testIdPrefix}-quantity-${idKey}`}>{quantity}</span>
    <button type="button" data-testid={`${testIdPrefix}-increase-${idKey}`} aria-label={`${t(lang,'addOne')} ${name}`} onClick={()=>onChange(1)}>+</button>
    <button type="button" className="removeLine" data-testid={`${testIdPrefix}-remove-${idKey}`} aria-label={`${t(lang,'remove')} ${name}`} onClick={onRemove}>{t(lang,'remove')}</button>
  </div>;
}
