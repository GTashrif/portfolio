(function () {
  "use strict";
  class JavaTraceError extends Error {}
  function tokenize(src) {
    const out=[]; let i=0,line=1;
    while(i<src.length){
      const c=src[i];
      if(c==="\n"){line++;i++;continue}
      if(/\s/.test(c)){i++;continue}
      if(src.slice(i,i+2)==="//"){while(i<src.length&&src[i]!=="\n")i++;continue}
      if(src.slice(i,i+2)==="/*"){i+=2;while(i<src.length&&src.slice(i,i+2)!=="*/"){if(src[i]==="\n")line++;i++}i+=2;continue}
      const start=i, ln=line;
      if(c==='"'||c==="'"){const q=c;i++;let val="";while(i<src.length&&src[i]!==q){if(src[i]==="\\"){i++;const e=src[i++];val+=e==="n"?"\n":e==="t"?"\t":e==="r"?"\r":e}else{if(src[i]==="\n")line++;val+=src[i++]}}if(src[i]!==q)throw new JavaTraceError("Unterminated string at line "+ln);i++;out.push({v:val,t:q==='"'?"str":"char",line:ln});continue}
      const num=src.slice(i).match(/^(?:\d+\.\d+|\d+)(?:[eE][+-]?\d+)?[fFdDlL]?/);
      if(num){i+=num[0].length;out.push({v:Number(num[0].replace(/[fFdDlL]$/,"")),t:"num",line:ln});continue}
      const id=src.slice(i).match(/^[A-Za-z_$][\w$]*/);
      if(id){i+=id[0].length;out.push({v:id[0],t:"id",line:ln});continue}
      const op=["++","--","+=","-=","*=","/=","%=","==","!=","<=",">=","&&","||","+=","->"].find(x=>src.startsWith(x,i));
      if(op){i+=op.length;out.push({v:op,t:"op",line:ln});continue}
      if("{}()[];,.?:+-*/%!=<>".includes(c)){i++;out.push({v:c,t:"op",line:ln});continue}
      throw new JavaTraceError("Unexpected character '"+c+"' at line "+ln);
    }
    out.push({v:"<eof>",t:"eof",line});return out;
  }
  const TYPES=new Set(["int","long","short","byte","double","float","boolean","char","String","var","void"]);
  const MODS=new Set(["public","private","protected","static","final","abstract","synchronized"]);
  class Parser{
    constructor(tokens){this.a=tokens;this.i=0}
    peek(n=0){return this.a[Math.min(this.i+n,this.a.length-1)]}
    is(v){return this.peek().v===v}
    take(){return this.a[this.i++]}
    eat(v){if(this.is(v)){this.i++;return true}return false}
    need(v){if(!this.eat(v))throw new JavaTraceError("Expected '"+v+"' at line "+this.peek().line)}
    id(){const x=this.take();if(x.t!=="id")throw new JavaTraceError("Expected identifier at line "+x.line);return x.v}
    skipMods(){while(MODS.has(this.peek().v))this.take()}
    parse(){
      while(this.eat("package")){while(!this.eat(";")&& !this.is("<eof>"))this.take()}
      while(this.eat("import")){while(!this.eat(";")&& !this.is("<eof>"))this.take()}
      const methods={},fields=[];
      while(!this.is("<eof>")){
        this.skipMods();
        if(this.eat("@")){while(!this.is("(")&&!this.is("{")&&!this.is("<eof>"))this.take();if(this.eat("(")){let d=1;while(d&& !this.is("<eof>")){if(this.eat("("))d++;else if(this.eat(")"))d--;else this.take()}}continue}
        if(this.eat("class")||this.eat("interface")||this.eat("enum")){
          const className=this.id();
          while(!this.is("{")&&!this.is("<eof>"))this.take();this.need("{");
          while(!this.is("}")&&!this.is("<eof>")){
            this.skipMods();if(this.is("}"))break;
            const type=this.parseType();const name=this.id();
            if(this.eat("(")){
              const params=[];if(!this.is(")")){do{while(MODS.has(this.peek().v))this.take();this.parseType();params.push(this.id());}while(this.eat(","))}
              this.need(")");const body=this.statement();methods[name]={params,body,returnType:type};
            }else{
              let init=null;if(this.eat("="))init=this.expression();fields.push({name,init,line:this.peek().line});while(!this.is(";")&&!this.is("<eof>"))this.take();this.eat(";");
            }
          }
          this.need("}");continue;
        }
        // Accept a bare method or statement body for snippets.
        const before=this.i;
        try{const type=this.parseType();const name=this.id();if(this.eat("(")){const params=[];if(!this.is(")")){do{this.parseType();params.push(this.id())}while(this.eat(","))}this.need(")");methods[name]={params,body:this.statement(),returnType:type};}else{this.i=before;throw new Error("not method")}}catch(e){if(e instanceof JavaTraceError)throw e;this.i=before;break}
      }
      let main=methods.main;
      if(!main){
        // Parse a class-free snippet as a sequence of statements.
        this.i=0;const body=[];while(!this.is("<eof>"))body.push(this.statement());
        main={params:[],body:{kind:"block",body,line:1}};
      }
      return {methods,main,fields};
    }
    parseType(){let t=this.take();if(t.t!=="id")throw new JavaTraceError("Expected type at line "+t.line);let s=t.v;while(this.eat("<")){let depth=1;while(depth&&!this.is("<eof>")){if(this.eat("<"))depth++;else if(this.eat(">"))depth--;else this.take()}}while(this.eat("[")){this.need("]");s+="[]"}return s}
    statement(){
      const line=this.peek().line;
      if(this.eat(";"))return{kind:"empty",line};
      if(this.eat("{")){const body=[];while(!this.is("}")&&!this.is("<eof>"))body.push(this.statement());this.need("}");return{kind:"block",body,line}}
      if(this.eat("if")){this.need("(");const test=this.expression();this.need(")");const yes=this.statement();const no=this.eat("else")?this.statement():null;return{kind:"if",test,yes,no,line}}
      if(this.eat("while")){this.need("(");const test=this.expression();this.need(")");return{kind:"while",test,body:this.statement(),line}}
      if(this.eat("for")){this.need("(");let init=null;if(!this.is(";"))init=this.looksLikeDecl()?this.declaration(false):{kind:"expr",expr:this.expression(),line};this.need(";");let test=null;if(!this.is(";"))test=this.expression();this.need(";");let update=null;if(!this.is(")"))update=this.expression();this.need(")");return{kind:"for",init,test,update,body:this.statement(),line}}
      if(this.eat("return")){const value=this.is(";")?null:this.expression();this.need(";");return{kind:"return",value,line}}
      if(this.eat("break")){this.need(";");return{kind:"break",line}}
      if(this.eat("continue")){this.need(";");return{kind:"continue",line}}
      if(this.eat("System")){this.need(".");this.need("out");this.need(".");const fn=this.id();if(fn!=="println"&&fn!=="print")throw new JavaTraceError("Only System.out.print/println is supported (line "+line+")");this.need("(");const args=[];if(!this.is(")")){do{args.push(this.expression())}while(this.eat(","))}this.need(")");this.need(";");return{kind:"print",args,newline:fn==="println",line}}
      if(this.looksLikeDecl())return this.declaration(true);
      const expr=this.expression();this.need(";");return{kind:"expr",expr,line};
    }
    looksLikeDecl(){let j=this.i;while(MODS.has(this.a[j]?.v))j++;if(this.a[j]?.t!=="id")return false;j++;while(this.a[j]?.v==="["){j++;if(this.a[j]?.v!=="]")return false;j++}if(this.a[j]?.t!=="id")return false;return ["=",";",",","["].includes(this.a[j+1]?.v)}
    declaration(semi){const line=this.peek().line;while(MODS.has(this.peek().v))this.take();const type=this.parseType();const vars=[];do{const name=this.id();let init=null;if(this.eat("="))init=this.expression();vars.push({name,init})}while(this.eat(","));if(semi)this.need(";");return{kind:"decl",type,vars,line}}
    expression(min=0){
      let left=this.prefix();
      const prec={"=":1,"+=":1,"-=":1,"*=":1,"/=":1,"%=":1,"||":2,"&&":3,"==":4,"!=":4,"<":5,">":5,"<=":5,">=":5,"+":6,"-":6,"*":7,"/":7,"%":7};
      while(true){const op=this.peek().v,p=prec[op]||0;if(p<=min)break;this.take();const right=this.expression(p-(p===1?1:0));left={kind:"binary",op,left,right,line:this.peek().line}}
      if(min===0&&this.eat("?")){const yes=this.expression();this.need(":");const no=this.expression();left={kind:"ternary",test:left,yes,no}}
      return left;
    }
    prefix(){
      const tok=this.take(),v=tok.v,line=tok.line;let x;
      if(v==="!"||v==="-"||v==="+"||v==="++"||v==="--")x={kind:"unary",op:v,arg:this.expression(8),line};
      else if(v==="("){x=this.expression();this.need(")")}
      else if(v==="{"){const items=[];if(!this.is("}")){do{items.push(this.expression())}while(this.eat(","))}this.need("}");x={kind:"array",items,line}}
      else if(tok.t==="num"||tok.t==="str"||tok.t==="char")x={kind:"lit",value:tok.t==="char"?v:v,line};
      else if(v==="true"||v==="false"||v==="null")x={kind:"lit",value:v==="true"?true:v==="false"?false:null,line};
      else if(v==="new"){const type=this.id();if(this.eat("[")){if(this.eat("]")){if(!this.eat("{"))throw new JavaTraceError("Expected array initializer after new "+type+"[] at line "+line);const items=[];if(!this.is("}")){do{items.push(this.expression())}while(this.eat(","))}this.need("}");x={kind:"array",items,line}}else{const size=this.expression();this.need("]");x={kind:"newarray",type,size,line}}}else throw new JavaTraceError("Object construction is not supported yet (line "+line+")")}
      else if(tok.t==="id"){x={kind:"var",name:v,line}}
      else throw new JavaTraceError("Unexpected token '"+v+"' at line "+line);
      while(true){
        if(this.eat("[")){const idx=this.expression();this.need("]");x={kind:"index",object:x,index:idx,line}}
        else if(this.eat(".")){const prop=this.id();x={kind:"member",object:x,prop,line}}
        else if(this.eat("(")){const args=[];if(!this.is(")")){do{args.push(this.expression())}while(this.eat(","))}this.need(")");x={kind:"call",callee:x,args,line}}
        else if(this.eat("++"))x={kind:"postfix",op:"++",arg:x,line};
        else if(this.eat("--"))x={kind:"postfix",op:"--",arg:x,line};
        else break;
      }
      return x;
    }
  }
  function runJavaTrace(source){
    const ast=new Parser(tokenize(source)).parse(),events=[],output=[];let steps=0;
    const globals=Object.create(null),stack=["main"];
    const snapshot=(line,env)=>{if(++steps>1500)throw new JavaTraceError("Trace stopped after 1,500 steps to prevent an infinite loop.");const vars={};for(let e=env;e;e=e.parent)for(const k of Object.keys(e.values))if(!(k in vars))vars[k]=clone(e.values[k]);events.push({line,vars,stack:stack.slice()})};
    const clone=v=>{if(Array.isArray(v))return v.map(clone);if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clone(x)]));return v};
    const env=(parent=null)=>({values:Object.create(null),parent});
    const get=(e,n)=>{for(let x=e;x;x=x.parent)if(n in x.values)return x.values[n];throw new JavaTraceError("Variable '"+n+"' is not defined.")};
    const set=(e,n,v)=>{for(let x=e;x;x=x.parent)if(n in x.values){x.values[n]=v;return v}e.values[n]=v;return v};
    const evalx=(n,e)=>{
      if(!n)return null;
      switch(n.kind){
        case"lit":return n.value;
        case"var":if(n.name==="this")return e.values;return get(e,n.name);
        case"array":return n.items.map(x=>evalx(x,e));
        case"newarray":{const size=Number(evalx(n.size,e));if(size<0||size>10000)throw new JavaTraceError("Invalid array size.");const fill=n.type==="boolean"?false:n.type==="String"?null:0;return Array(size).fill(fill)}
        case"member":{const o=evalx(n.object,e);if(n.prop==="length"&&Array.isArray(o))return o.length;if(o==null)throw new JavaTraceError("Cannot read property '"+n.prop+"' of null.");return o[n.prop]}
        case"index":return evalx(n.object,e)[evalx(n.index,e)];
        case"unary":{if(n.op==="!")return !evalx(n.arg,e);if(n.op==="-")return -evalx(n.arg,e);if(n.op==="+")return +evalx(n.arg,e);const old=evalx(n.arg,e),val=n.op==="++"?old+1:old-1;assign(n.arg,e,val);return val}
        case"postfix":{const old=evalx(n.arg,e);assign(n.arg,e,n.op==="++"?old+1:old-1);return old}
        case"ternary":return evalx(n.test,e)?evalx(n.yes,e):evalx(n.no,e);
        case"binary":{
          if(n.op==="&&"){const a=evalx(n.left,e);return a&&evalx(n.right,e)}
          if(n.op==="||"){const a=evalx(n.left,e);return a||evalx(n.right,e)}
          const a=evalx(n.left,e),b=evalx(n.right,e);
          switch(n.op){case"+":return a+b;case"-":return a-b;case"*":return a*b;case"/":return a/b;case"%":return a%b;case"==":return a==b;case"!=":return a!=b;case"<":return a<b;case">":return a>b;case"<=":return a<=b;case">=":return a>=b;case"=":return assign(n.left,e,b);case"+=":return assign(n.left,e,a+b);case"-=":return assign(n.left,e,a-b);case"*=":return assign(n.left,e,a*b);case"/=":return assign(n.left,e,a/b);case"%=":return assign(n.left,e,a%b)}
        }
        case"call":{
          if(n.callee.kind==="member"&&n.callee.object.kind==="var"&&n.callee.object.name==="System")throw new JavaTraceError("Use System.out.println(...) as a statement.");
          if(n.callee.kind==="member"){const obj=evalx(n.callee.object,e),args=n.args.map(x=>evalx(x,e));if(n.callee.prop==="length")return obj.length;if(n.callee.prop==="charAt"&&typeof obj==="string")return obj.charAt(args[0]);if(n.callee.prop==="toUpperCase"&&typeof obj==="string")return obj.toUpperCase();if(n.callee.prop==="toLowerCase"&&typeof obj==="string")return obj.toLowerCase();if(n.callee.prop==="toString")return String(obj);if(n.callee.prop==="add"&&Array.isArray(obj)){obj.push(args[0]);return true}if(n.callee.prop==="get"&&Array.isArray(obj))return obj[args[0]];if(n.callee.prop==="set"&&Array.isArray(obj)){obj[args[0]]=args[1];return null}throw new JavaTraceError("Unsupported method: "+n.callee.prop)}
          if(n.callee.kind==="var"){const name=n.callee.name,fn=ast.methods[name];if(!fn)throw new JavaTraceError("Unknown method '"+name+"'.");if(stack.length>30)throw new JavaTraceError("Maximum call depth reached.");const local=env(globals);fn.params.forEach((p,i)=>local.values[p]=evalx(n.args[i],e));stack.push(name);snapshot(n.line,local);try{const r=exec(fn.body,local);return r&&r.type==="return"?r.value:null}finally{stack.pop()}}
          throw new JavaTraceError("Unsupported function call.");
        }
      }
    };
    function assign(n,e,v){if(n.kind==="var")return set(e,n.name,v);if(n.kind==="index"){const o=evalx(n.object,e),i=evalx(n.index,e);o[i]=v;return v}if(n.kind==="member"){const o=evalx(n.object,e);o[n.prop]=v;return v}throw new JavaTraceError("Invalid assignment target.")}
    function exec(s,e){
      if(!s)return null;
      switch(s.kind){
        case"empty":return;
        case"block":{const local=env(e);for(const st of s.body){const r=exec(st,local);if(r)return r}return}
        case"decl":for(const v of s.vars)e.values[v.name]=v.init?evalx(v.init,e):(["boolean"].includes(s.type)?false:["String"].includes(s.type)?null:0);snapshot(s.line,e);return;
        case"expr":evalx(s.expr,e);snapshot(s.line,e);return;
        case"print":{const vals=s.args.map(x=>evalx(x,e));output.push(vals.map(v=>v===null?"null":String(v)).join(" ")+(s.newline?"\n":""));snapshot(s.line,e);return}
        case"if":{const yes=!!evalx(s.test,e);snapshot(s.line,e);return exec(yes?s.yes:s.no,e)}
        case"while":{let n=0;while(evalx(s.test,e)){if(++n>500)throw new JavaTraceError("Loop exceeded 500 iterations.");snapshot(s.line,e);const r=exec(s.body,e);if(r?.type==="return")return r;if(r?.type==="break")break}return}
        case"for":{const local=env(e);if(s.init){if(s.init.kind==="decl"){for(const v of s.init.vars)local.values[v.name]=v.init?evalx(v.init,local):0;snapshot(s.init.line,local)}else{evalx(s.init.expr,local);snapshot(s.init.line,local)}}let n=0;while(!s.test||evalx(s.test,local)){if(++n>500)throw new JavaTraceError("Loop exceeded 500 iterations.");snapshot(s.line,local);const r=exec(s.body,local);if(r?.type==="return")return r;if(r?.type==="break")break;if(s.update)evalx(s.update,local)}return}
        case"return":return{type:"return",value:s.value?evalx(s.value,e):null};
        case"break":return{type:"break"};
        case"continue":return{type:"continue"};
      }
    }
    try{
      const root=env();for(const f of ast.fields)root.values[f.name]=f.init?evalx(f.init,root):null;
      stack[0]="main";const result=exec(ast.main.body,root);return{events,output:output.join(""),error:null};
    }catch(err){return{events,output:output.join(""),error:err.message||String(err)}}
  }
  window.runJavaTrace=runJavaTrace;
})();