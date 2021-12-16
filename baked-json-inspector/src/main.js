import $ from "jquery";
import _ from "lodash";
import d3 from "d3";

$("#view").on("click", "li", function() {
  $(this).toggleClass("open");
  return false;
});

let percent = d3.format(".0%");
let percent4dp = d3.format(".4%");

$("#select_file").on("change", function() {
  let filename = $(this).val();
  d3.json(`output/${filename}`, function(error, data) {

    console.log(data);

    let total = data.count;

    let root = d3.select("#view")
        .html("")
        .classed("open", true);

    root.datum(data.result)
        .call(buildTree);

    function buildTree(selection) {
      selection.each(function(data) {

        let root = d3.select(this);

        if (data.values) {
          let container = root.append("ul")
              .attr("class", "values");

          container.selectAll("li")
              .data(_.sortBy(data.values, "value"))
            .enter()
              .append("li")
              .append("span")
                .attr("class", "content")
                .text(d => JSON.stringify(d.value))
              .append("div")
                .attr("class", "occurs")
                .text(d => percent(d.occurs / total))
                .style("width", d => percent4dp(d.occurs / total));

          if (data.too_many_values) {
            container.append("li")
              .append("span")
                .attr("class", "content too_many_values")
                .text("too many values");
          }
        }

        if (data.list) {
          root.append("ul")
              .attr("class", "list")
            .append("li")
              .datum(data.list)
              .call(buildTree);
        }

        if (data.keys) {
          let keys = root.append("ul")
              .attr("class", "keys")
            .selectAll("li")
              .data(_.sortBy(pullKeys(data.keys), "key"))
            .enter()
              .append("li")
              .classed("expandable", d => d.keys != null || d.list != null);

          keys.append("div")
              .attr("class", "content")
              .text(d => JSON.stringify(d.key))
            .append("div")
              .attr("class", "occurs")
              .text(d => percent(d.occurs / total))
              .style("width", d => percent4dp(d.occurs / total));

          keys.call(buildTree);
        }

      });
    }
  });
});

function pullKeys(obj) {
  return _.map(obj, (value, key) => {
    value.key = key;
    return value;
  });
}
