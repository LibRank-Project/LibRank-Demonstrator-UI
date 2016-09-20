can.Component.extend({
  tag: 'dropdown-bootstrap',
  viewModel: { 
    items: [],
    selected: { label: "foo" },
    is_selected: function(x) {
      return this.attr("selected") === x;
    },
    select: function(x) {
      this.attr("selected", x);
    },
  },
  events: {
    inserted: function() {
      this.viewModel.select(this.viewModel.attr("items.0"));
    }
  },
  template: can.view('components/dropdown/dropdown.stache'),
});
