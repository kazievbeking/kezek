import {useEffect,useState} from 'react';

export const ownerSections=[
 ['companies','▦'],['companyBranches','⌘'],['branches','⌖'],['installations','▣'],
 ['tokens','⌁'],['devices','⊞'],
 ['audit','≡'],['updates','↑'],['owners','◇'],
] as const;
export type OwnerSection=typeof ownerSections[number][0];
function currentSection():OwnerSection {const key=location.hash.slice(1);return ownerSections.find(([section])=>section===key)?.[0]||'companies';}
export function useOwnerSection(){const [section,setSection]=useState(currentSection);useEffect(()=>{const change=()=>setSection(currentSection());window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);return section;}
