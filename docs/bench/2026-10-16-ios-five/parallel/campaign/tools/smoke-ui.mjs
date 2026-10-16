// Functional diagnostics only. No hook or source replacement; invoke mounted real handlers.
export function installSmoke(agentId){
 const g=globalThis;
 const walk=(node,visit)=>{if(!node)return;visit(node,node.type?.displayName||node.type?.name||'');walk(node.child,visit);walk(node.sibling,visit);};
 const find=(start,predicate)=>{let result;walk(start,(n,name)=>{if(!result&&predicate(n.memoizedProps??{},name))result=n;});return result;};
 const viewport=()=>{let result;const hook=g.__REACT_DEVTOOLS_GLOBAL_HOOK__;for(const id of hook.renderers.keys())for(const root of hook.getFiberRoots(id)){const n=find(root.current,(p,name)=>name==='NativeStreamViewport'&&p.agentId===agentId);if(n)result=n;}return result;};
 const card=()=>find(viewport()?.child,(p,name)=>name==='ReasoningCard'&&typeof p.copyText==='string');
 g.__fiveSmoke={
  snapshot(){const n=card(),p=n?.memoizedProps;return p?{streaming:p.streaming,expanded:p.expanded,raw:p.copyText,bodyChars:p.segmentation.kind==='prose'?p.segmentation.body.length:0}:null;},
  open(){const n=card();if(!n)throw Error('thought card missing');const p=n.memoizedProps;if(p.expanded)throw Error('default thought unexpectedly expanded');const press=find(n.child,p=>typeof p.onPress==='function'&&p.accessibilityRole==='button'&&String(p.accessibilityLabel).startsWith('Thinking'));if(!press)throw Error('thought Pressable missing');const before=p.copyText;press.memoizedProps.onPress();return {before,input:'mounted Pressable.onPress via CDP'};},
  copy(){const n=card();const source=find(n?.child,(p,name)=>name==='ToolbarCopyButton'&&p.label==='Copy thought');const button=find(n?.child,(p,name)=>name==='ToolbarButton'&&p.label==='Copy thought'&&typeof p.onPress==='function');if(!source||!button)throw Error('real thought copy action missing');const value=source.memoizedProps.text;const expected=typeof value==='function'?value():value;const current=n.memoizedProps.copyText;button.memoizedProps.onPress();return{expected,current,sourceMatchesCurrent:expected===current.trim(),input:'mounted ToolbarButton.onPress -> SDK clipboard'};}
 };
 return true;
}
