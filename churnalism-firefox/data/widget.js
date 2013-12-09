
function reconfig(params) {
//  console.log("button.js: reconfig");
  var icons = {
    'off': "widget-off.png",
    'on': "recycle-on.png",
  };

  var icon_img = document.getElementById("icon-img");
  icon_img.src = icons[params.icon];

  var msg = document.getElementById("widget-msg");
  msg.innerHTML = params['msg'];
}


self.port.on("reconfig", reconfig);

