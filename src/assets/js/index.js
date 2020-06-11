import RommeCal from './modules/chart';

function getCurrentPlayers() {
  return $('.img-player.active')
    .map((index, element) => $(element).data('player'))
    .get();
}

$(document).ready(() => {
  // draw chart
  RommeCal.init('#chart-container');

  // update chart when player selection is updated
  $('.img-player').on('click', (event) => {
    $(event.currentTarget).toggleClass('active');

    const players = getCurrentPlayers();
    RommeCal.updatePlayers(players);
  });
});
