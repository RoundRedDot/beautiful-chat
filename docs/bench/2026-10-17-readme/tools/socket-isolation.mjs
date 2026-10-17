// Never enable Playwright WebSocket routing: even unmatched sockets can pass
// through its Node forwarding path while synchronous Paseo CLI waits block.
// Fresh lane profiles contain only their compiled private daemon endpoint.
export function ownedSocket(url,port){
  return ['127.0.0.1','localhost'].includes(url.hostname)&&url.port===String(port);
}
export function observeSockets(page,port){
  const violations=[];
  page.on('websocket',socket=>{
    const url=new URL(socket.url());
    if(!ownedSocket(url,port))violations.push({hostname:url.hostname,port:url.port});
  });
  return violations;
}
