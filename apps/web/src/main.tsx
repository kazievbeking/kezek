import {createRoot} from 'react-dom/client';
import {App} from './App';
import {I18n} from './i18n';
import './styles.css';
createRoot(document.getElementById('root')!).render(<I18n><App/></I18n>);
