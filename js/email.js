$('a.icon-email').on('click', function(){
    var href = $(this).attr('href');
    $(this).attr('href', href.replace('badmail.', ''));
});