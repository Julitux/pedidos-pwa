$port = 3000
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = @"
const h=require('http'),f=require('fs'),p=require('path');
const m={css:'text/css',js:'text/javascript',json:'application/json',svg:'image/svg+xml',html:'text/html'};
h.createServer((q,r)=>{const u=p.join('.',q.url==='/'?'index.html':q.url);f.readFile(u,(e,d)=>{if(e){r.writeHead(404);r.end('Not found')}else{r.writeHead(200,{'Content-Type':m[p.extname(u).slice(1)]||'text/plain'});r.end(d)}})}).listen($port,()=>console.log('Servidor en http://localhost:$port'))
"@
Write-Host "Iniciando servidor en http://localhost:$port" -ForegroundColor Green
node -e $script
