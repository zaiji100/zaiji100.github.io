!function ($) {

  $(function() {

    var $window = $(window)
	var h2 = [];

    // side bar
    setTimeout(function () {
	  var b = $('.bs-post-sidebar')
      b.affix({
        offset: {
          top: function(){ var c=b.offset().top, d=parseInt(b.children(0).css("margin-top"),10), e=$(".bs-post-nav").height(); return this.top=c-e-d }
        , bottom: function(){return this.bottom=$(".bs-wiki-footer").outerHeight(!0)}
        }
      })
	  var bb = $('.bs-wiki-sidebar')
      bb.affix({
        offset: {
          top: function(){ var c=bb.offset().top, d=parseInt(bb.children(0).css("margin-top"),10), e=$(".bs-post-nav").height(); return this.top=c-e-d }
        , bottom: function(){return this.bottom=$(".bs-wiki-footer").outerHeight(!0)}
        }
      })
    }, 100)
	
	var container = $('.wiki-content')
	container.find('h2').each(function() {
		h2.push(this)
	})
	var cache = "";
	h2.forEach(function(node) {
		cache += '<li><a href="#' + node.id + '">' + $(node).text() + '</a></li>'
	})
	$('.bs-post-sidenav').append(cache)
	
	$('body').scrollspy({target:".bs-wiki-sidebar"})
})
}(window.jQuery)