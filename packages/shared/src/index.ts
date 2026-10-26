export const VERSION='1.0.0';
export {serviceAncestors,serviceAvailable,descendantServiceIds,servicePath,serviceTreeRows} from './services.js';
export const PROTOCOL=1;
export const RUNTIME_PROTOCOL=2;
export const RUNTIME_VERSION='1.1.0';
export type Role='COMPANY_ADMIN'|'BRANCH_ADMIN'|'STAFF'|'TERMINAL'|'DISPLAY'|'WORKSTATION';
export interface Principal {id:string;companyId:string;companyBranchId?:string;role:Role;branchIds:string[];branchId:string;deskIds:string[];serviceIds:string[];device:boolean;mustChange:boolean;locale?:Locale;delegated?:boolean;ownerName?:string}
export const scopes={admin:['COMPANY_ADMIN','BRANCH_ADMIN'],staff:['COMPANY_ADMIN','BRANCH_ADMIN','STAFF']};
export type Locale='ru'|'kk'|'en';
export type Localized={ru:string;kk?:string;en?:string};
export function localized(value:any,locale:Locale='ru'):string {return typeof value==='string'?value:value?.[locale]||value?.ru||value?.en||'';}
