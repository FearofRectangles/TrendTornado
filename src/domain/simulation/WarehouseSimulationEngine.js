import {
  OrderSimulationEngine,
} from "./OrderSimulationEngine.js";


export class WarehouseSimulationEngine {
  static simulate({
    orders,
  }) {
    if (!Array.isArray(orders)) {
      throw new TypeError(
        "Orders must be an array.",
      );
    }


    const orderSimulations = [];

    let totalPicks = 0;

    let totalPickSpan = 0;

    let totalMultiPickSpan = 0;

    let singlePickGroups = 0;

    let multiPickGroups = 0;

    let correctlyOrderedPairs = 0;

    let comparablePairs = 0;


    for (const order of orders) {
      if (
        !order ||
        typeof order !== "object"
      ) {
        throw new TypeError(
          "Every order must be an object.",
        );
      }


      const simulation =
        OrderSimulationEngine.simulate({
          documentNumber:
            order.documentNumber,

          picks:
            order.picks,
        });


      orderSimulations.push(
        simulation,
      );


      // ------------------------------------------------
      // Picks
      // ------------------------------------------------

      totalPicks +=
        simulation.pickCount;


      // ------------------------------------------------
      // Pick span
      //
      // We keep the original warehouse-wide average
      // across all simulation groups.
      //
      // We also calculate a separate average for groups
      // containing at least two picks. Single-pick
      // groups always have a span of zero and can
      // otherwise make the average look artificially
      // short.
      // ------------------------------------------------

      totalPickSpan +=
        simulation.pickSpan;


      if (
        simulation.pickCount === 1
      ) {
        singlePickGroups++;
      }


      if (
        simulation.pickCount >= 2
      ) {
        multiPickGroups++;

        totalMultiPickSpan +=
          simulation.pickSpan;
      }


      // ------------------------------------------------
      // Weight ordering
      // ------------------------------------------------

      correctlyOrderedPairs +=
        simulation
          .correctlyOrderedPairs;

      comparablePairs +=
        simulation
          .comparablePairs;
    }


    // --------------------------------------------------
    // Group counts
    // --------------------------------------------------

    const simulatedOrders =
      orderSimulations.length;


    // --------------------------------------------------
    // Average pick span - all groups
    // --------------------------------------------------

    const averagePickSpan =
      simulatedOrders === 0
        ? 0
        : totalPickSpan /
          simulatedOrders;


    // --------------------------------------------------
    // Average pick span - multi-pick groups only
    // --------------------------------------------------

    const averageMultiPickSpan =
      multiPickGroups === 0
        ? 0
        : totalMultiPickSpan /
          multiPickGroups;


    // --------------------------------------------------
    // Weight ordering
    //
    // Aggregate raw comparable pairs rather than
    // averaging each group's individual score.
    // --------------------------------------------------

    const weightOrderScore =
      comparablePairs === 0
        ? 1
        : correctlyOrderedPairs /
          comparablePairs;


    // --------------------------------------------------
    // Result
    // --------------------------------------------------

    return {
      simulatedOrders,

      totalPicks,

      singlePickGroups,

      multiPickGroups,

      averagePickSpan,

      averageMultiPickSpan,

      correctlyOrderedPairs,

      comparablePairs,

      weightOrderScore,

      orderSimulations,
    };
  }
}