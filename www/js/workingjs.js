var requestToken = "";
var idToken = "";
var clientId = "1062303130230-6qnv8dn2tlfib1jt1v003go8rder63qn.apps.googleusercontent.com";
var clientSecret = "0H1D0K4lJXmrFDerpEiHxcQg";
var googleResponse = {};
var identityPoolId = "us-east-1:409dad3a-5fd7-4449-b07d-c57bd1df768d";
var accountID = "940653267411";

// MAP PARAMETER HERE
var posOptions = {timeout: 5000, enableHighAccuracy: true}; 

var locationUpdateInterval = 2000; // in ms
    // initialized default location and map options


// map option, set time out sand high accuracy



// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('starter', ['ionic',"ngCordova"])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
  });
})

.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('login', {
            url: '/login',
            templateUrl: 'login.html',
            controller: 'LoginController'
        })
        .state('secure', {
            url: '/map',
            templateUrl: 'map.html',
            controller: 'MapController'
        });
    $urlRouterProvider.otherwise('/login');
})

.controller('LoginController', function($scope, $http, $location) {
 
    $http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

    $scope.login = function() {
      // create an in app browser and listen to the call back
        var ref = window.open('https://accounts.google.com/o/oauth2/auth?client_id=' + clientId + '&redirect_uri=http://localhost/callback&scope=https://www.googleapis.com/auth/userinfo.email&approval_prompt=force&response_type=code&access_type=offline', '_blank', 'location=no');
        ref.addEventListener('loadstart', function(event) { 
            if((event.url).startsWith("http://localhost/callback")) {
                requestToken = (event.url).split("code=")[1];
                $http({method: "post", url: "https://www.googleapis.com/oauth2/v3/token", data: "client_id=" + clientId + "&client_secret=" + clientSecret + "&redirect_uri=http://localhost/callback" + "&grant_type=authorization_code" + "&code=" + requestToken })
                    .success(function(data) {
                        // assign token to global variable

                        idToken = data.id_token;
                        googleResponse = data;
                        // access 2nd route
                        $location.path("/map");
                    })
                    .error(function(data, status) {
                        alert("ERROR: " + data);
                    });
                ref.close();
            }
        });
    }
 
    if (typeof String.prototype.startsWith != 'function') {
        String.prototype.startsWith = function (str){
            return this.indexOf(str) == 0;
        };
    }
    
})

.controller('MapController', function($scope, $ionicLoading,$cordovaDevice) {

    //start tracking 
    
    // get id token to display
    $scope.idToken = idToken;
    // initialize the map with map option global
    $scope.mapObject = new mapObject(); 
    // initalize cognitoObject with idToken
    $scope.cognitoObject = new cognitoObject(idToken);

    // initialize data object to send
    $scope.data = {"success":true,"ErrCode":0,"lat":0,"lng":0,timeStamp:new Date(),deviceModel:"",deviceId:"",userEmail:$scope.cognitoObject.userEmail}; 
    
    // initialize allowing upload
    
    $scope.uploading=true;
    // get google response for debugging purpose
    $scope.googleResponse = googleResponse;

    $scope.s3Object = new s3Object();
    // this call backfunction is used to update data object 
   var updateLocationData= function(pos){
      // update the data json info
      $scope.data.success= true;
      $scope.data.ErrCode = 0;
      $scope.data.lat = pos.coords.latitude;
      $scope.data.lng = pos.coords.longitude;
      $scope.data.timeStamp = new Date();

      // update display map
      $scope.mapObject.updateMap(pos);

      //propagate change through the scope
      $scope.$apply();

      // Initialize parameter for S3 bucket 
      $scope.uploaded = $scope.s3Object.upload($scope.data.deviceId+"/"+$scope.data.timeStamp.valueOf(),$scope.data);
      $scope.errorMessage
   }

   // this callback is used to handle error when pull notifaction
   var errorOccured= function(err){
      $scope.data.success= false;
      $scope.data.ErrCode= err.code;
      $scope.data.lat = "0";
      $scope.data.lng = "0";
      $scope.data.timeStamp = new Date();
      $scope.$apply()
   }


    // function wrapper to put into
    function trackFunction() {
      navigator.geolocation.getCurrentPosition(updateLocationData, errorOccured, posOptions);
    };



   // initialize the map canvas on front end
   google.maps.event.addDomListener(window, 'load', function() {
        // fire this oncce to initialize the map
        trackFunction();
         // initialize a watch for change in location
        $scope.watchID = setInterval(trackFunction,locationUpdateInterval);
    });

   // TOGGLE TRACKING METHOD
    $scope.toggleTracking = function()
   {
      // if is currently tracking
      if ($scope.watchID) {
        // clear the all location watch and set the watch id to null
        clearInterval($scope.watchID);
        $scope.watchID=null;

        // set data to unavailable
        $scope.data={"success":false,"ErrCode":3,"lat":0,"lng":0,"timeStamp":new Date()};

        // remove marker from map
        $scope.mapObject.stopTracking();
      }else{

        // reinitialize a watch for location
        $scope.watchID =  setInterval(trackFunction,locationUpdateInterval);

      }
   }


  document.addEventListener("deviceready", function () {
     $scope.data.deviceId= $cordovaDevice.getUUID();
     $scope.data.deviceModel= $cordovaDevice.getModel();
  }, false);



});




//--------MAP PART-----------------------------
// declare map object
var mapObject = function() {
      //--------Map config and method------------------
    var vm = this;
    vm.myLatlng = new google.maps.LatLng(37.3000, -120.4833), 
    vm.mapOptions = {center: vm.myLatlng,
                  zoom: 16,
                  mapTypeId: google.maps.MapTypeId.ROADMAP
                };
    // initialize the map with map option
    vm.map=new google.maps.Map(document.getElementById("map"), vm.mapOptions);
    vm.markerTitle = "Current Location";
    // initalize marker
    vm.myLocation = new  google.maps.Marker();
    // helper method to update local map
    vm.updateMap = function(pos){
      vm.map.setCenter(new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude));

      // update marker
      vm.myLocation.setMap(null); // unset the old one
      vm.myLocation = new google.maps.Marker({ 
          position: new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude),
          map: vm.map,
          title: vm.markerTitle
      });
    };
    vm.setMarkerTitle = function(markerTitle){
      vm.markerTitle = markerTitle;
    }
    vm.stopTracking =function(){
      vm.myLocation.setMap(null);
    }

    return vm;
}


//-------- COGNITO PART-----------------------------
// helper method to decode JWT from google
var decodeIdToken = function(id_token){
  var tokenSegment = id_token.split('.'); //split string based on. 
  // convert according to standard and parse JSON back
  return [JSON.parse(b64utoutf8(tokenSegment[0])),JSON.parse(b64utoutf8(tokenSegment[1])),b64utohex(tokenSegment[2])]; 
}
// extract email value from decoded 2nd segment of id_token 
var getEmailFromToken=function (id_token){
    var userInfo = decodeIdToken(id_token)[1]; // user info in 2nd segment
    return userInfo.email;

}



// declare cognito Object
var cognitoObject = function(id_token){
  var vm = this
      vm.params = {
       IdentityPoolId:identityPoolId,
       AccountId:accountID,
        Logins: { 
          'accounts.google.com':id_token
        }
      },
      vm.cognigtoIdentity = "";
      vm.awsCredentials="";
      vm.errMessage = "";

      vm.userEmail ="";
      if (id_token != undefined && id_token != "" ){
        vm.userEmail = getEmailFromToken(id_token);
      }

   AWS.config.region = 'us-east-1';
   AWS.config.credentials = new AWS.CognitoIdentityCredentials(vm.params);

   AWS.config.credentials.get(function(err) {
       if (!err) {
            vm.cognigtoIdentity = AWS.config.credentials.identityId;
            vm.awsCredentials = AWS.config.credentials;
       }else{
        vm.errMessage =err.message;
       }
   });

   return vm;
}

var s3Object = function(awsCredentials){
  var vm = this;
  vm.S3 = new AWS.S3(awsCredentials);
  vm.bucket = "argotraqloctest"
  vm.path = "NeilTest/";
  vm.filename= '';
  vm.data='';
  vm.uploadResult = false;
  vm.bucketParams = {
        // bucket name
        Bucket:vm.bucket, 
        // key of opject to put data in ( will be directory/filename on s3) 
        //,in this case store in a file whose name is device'sID

        Key: vm.path+vm.filename,
        
        // full access for testing
        ACL:'bucket-owner-full-control', // full access for testing

        // Json version of data
        Body:JSON.stringify(vm.data) 

      } ;
  vm.setBucket =function(bucket){
    vm.bucket = bucket
  }
  vm.setFileName = function(filename){
    vm.bucketParams.Key = vm.path+filename;
  }

  vm.setPath = function(path){
    vm.path = path; // this will be appply to
  }
  vm.setData = function(data){
     vm.bucketParams.Body = JSON.stringify(data);
  }

  vm.upload= function(filename,file){
      vm.setFileName(filename);
      vm.setData(file);
      vm.S3.putObject(vm.bucketParams,function(err,data){
        if (err) {vm.uploadResult =false} // an error occurred
        else     {vm.uploadResult=true;} // successful response
       
      });
     return vm.uploadResult    
  }
  return vm      
}