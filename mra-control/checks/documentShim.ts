// The LED color block's field builds page elements when it's created, and Node has no page. Import before the blocks.
// (jsdom comes with Blockly, which uses it for its own Node build.)
import {JSDOM} from 'jsdom';

const {window} = new JSDOM('');
globalThis.document ??= window.document;
// Blockly checks its dropdown options are page elements with instanceof
globalThis.HTMLElement ??= window.HTMLElement;
