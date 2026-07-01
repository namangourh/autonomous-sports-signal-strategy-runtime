package com.assr.signalengine.strategy;

/**
 * Removes bookmaker margin (vig) from a 3-way decimal-odds market by
 * normalizing implied probabilities so they sum to 1. Pure function, no
 * TxLINE-specific parsing here — see OddsQuote for the input shape.
 */
public final class OddsDevigCalculator {

    private OddsDevigCalculator() {
    }

    public record FairProbabilities(double home, double draw, double away) {
    }

    public static FairProbabilities devig(double homeOdds, double drawOdds, double awayOdds) {
        double impliedHome = 1.0 / homeOdds;
        double impliedDraw = 1.0 / drawOdds;
        double impliedAway = 1.0 / awayOdds;
        double overround = impliedHome + impliedDraw + impliedAway;
        return new FairProbabilities(
                impliedHome / overround,
                impliedDraw / overround,
                impliedAway / overround);
    }

    /** Edge of a candidate price against a fair probability, as a fraction (e.g. 0.04 = 4%). */
    public static double edge(double candidateOdds, double fairProbability) {
        double impliedByCandidate = 1.0 / candidateOdds;
        return fairProbability - impliedByCandidate;
    }
}
