<!-- AIS HG8045X6 Wi-Fi MAC filter page, trimmed; MACs and names replaced -->
<html><head><title>WLAN MAC Filter</title><script language="JavaScript" type="text/javascript">
var selctIndex = -1;
var numpara = "";
var portid  = "";
var TableName = "WMacfilterConfigList";
var SSIDnum = 8;
var DoubleFreqFlag = '1';  
var ProductType = '1';  

var IsPTVDFFlag = '0';
var CfgModeWord ='AISAP'; 
var ApAdaptValue = '1';
var ApModeValue = '1';

var BeltelePONFlag = '0';
var BelteleLanFlag = '0';

var isNewAp = "0";

var NosFlag = '0';
var isDevTypeFlag = '0';
var fttrFlag = '0';

var wlanName = GetSSIDList();

var enableFilter = '1';
var Mode = '1';

var MacFilterSrc = new Array(new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.1","SSID\x2d1","Phone A","02\x3a00\x3a00\x3a00\x3a00\x3a01"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.2","SSID\x2d5","Phone A","02\x3a00\x3a00\x3a00\x3a00\x3a01"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.3","SSID\x2d1","Phone B","02\x3a00\x3a00\x3a00\x3a00\x3a02"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.4","SSID\x2d5","Phone B","02\x3a00\x3a00\x3a00\x3a00\x3a02"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.5","SSID\x2d1","Shop PC","02\x3a00\x3a00\x3a00\x3a00\x3a03"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.6","SSID\x2d5","Shop PC","02\x3a00\x3a00\x3a00\x3a00\x3a03"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.7","SSID\x2d1","Phone C","02\x3a00\x3a00\x3a00\x3a00\x3a04"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.8","SSID\x2d5","Phone C","02\x3a00\x3a00\x3a00\x3a00\x3a04"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.9","SSID\x2d1","Phone D","02\x3a00\x3a00\x3a00\x3a00\x3a05"),new stMacFilter("InternetGatewayDevice.X_HW_Security.WLANMacFilter.10","SSID\x2d5","Phone D","02\x3a00\x3a00\x3a00\x3a00\x3a05"),null);
return;
}

    var enable = getElById("EnableMacFilter").checked;
    var EnableMacFilter = (enable == true) ? 1 : 0;
    var WMacfilterSpecCfgParaList = new Array(new stSpecParaArray("x.SourceMACAddress",getValue('SourceMACAddress'), 1),
                                            new stSpecParaArray("x.SSIDName",getValue('ssidindex'), 1),
                                            new stSpecParaArray("x.DeviceName",getValue('DeviceName'), 1),
                                            new stSpecParaArray("x.Enable",1, 1));


    var url = '';
    if( selctIndex == -1 )
{
 url = 'add.cgi?x=InternetGatewayDevice.X_HW_Security.WLANMacFilter'
                        + '&RequestFile=html/bbsp/wlanmacfilter/wlanmacfilter.asp';
}
else
{
     url = 'set.cgi?x=' + MacFilter[selctIndex].domain

        $.ajax({
             type : "POST",
             async : false,
             cache : false,
             data : "x.WlanMacFilterRight=" + MacFilterInRightValue +"&x.X_HW_Token="+getValue('onttoken'),
             url : "set.cgi?x=InternetGatewayDevice.X_HW_Security&RequestFile=html/bbsp/wlanmacfilter/wlanmacfilter.asp",
             success : function(data) {
             },
             complete: function (XHR, TS) {
                XHR=null;
             }
  </script><input type="hidden" name="onttoken" id="hwonttoken" value="{TOKEN}"> 
</html>
