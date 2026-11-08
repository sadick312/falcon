import AntiBuller from "@combat-modules/AntiBuller";
import AppleInstakiller from "@combat-modules/AppleInstakiller";
import AutoAttacker from "@combat-modules/AutoAttacker";
import AutoInstakiller from "@combat-modules/AutoInstakiller";
import AutoMeleeSyncer from "@combat-modules/AutoMeleeSyncer";
import AutoPusherStriker from "@combat-modules/AutoPushStriker";
import BarbarianKnockbacker from "@combat-modules/BarbarianKnockbacker";
import MusketInstakiller from "@combat-modules/MusketInstakiller";
import OneTicker from "@combat-modules/OneTicker";
import ProjectileSyncer from "@combat-modules/ProjectileSyncer";
import ShameGrinder from "@combat-modules/ShameGrinder";
import SpikeTicker from "@combat-modules/SpikeTicker";
import TurretAPAssister from "@combat-modules/TurretAPAssister";
import TurretGearKnockbacker from "@combat-modules/TurretGearKnockbacker";
import VelocityAttacker from "@combat-modules/VelocityAttacker";
import { registerAttackModules } from "@core/mod/combat/core/attackModuleRegistry";
import DefensiveKnockbacker from "@core/mod/defense/modules/DefensiveKnockbacker";

// Registers how to create the attack modules; attackModuleRegistry creates them the first time AttackManager asks.
// The modules import AttackManager (to queue attacks), so AttackManager can't import them back; ModManager loads this
// file instead. Same instances, same order as before.
registerAttackModules(() => {
    const spikeTicker = new SpikeTicker();
    const appleInstakiller = new AppleInstakiller();
    const shameGrinder = new ShameGrinder();
    const antiBuller = new AntiBuller();
    const oneTicker = new OneTicker();

    const modules = [
        antiBuller,
        new AutoInstakiller(),
        new MusketInstakiller(),
        new AutoAttacker(),
        new ProjectileSyncer(),
        new AutoPusherStriker(),
        new TurretAPAssister(),
        new VelocityAttacker(),
        new DefensiveKnockbacker(),
        new AutoMeleeSyncer(),
        new TurretGearKnockbacker(),
        new BarbarianKnockbacker(),
        // Before Apple Insta: while it grinds the enemy's shame, Apple Insta waits (holdsAppleInsta).
        shameGrinder,
        appleInstakiller,
        spikeTicker,
        oneTicker
    ];

    return { spikeTicker, appleInstakiller, shameGrinder, antiBuller, oneTicker, modules };
});
