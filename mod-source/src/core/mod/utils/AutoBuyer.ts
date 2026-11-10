import store, { STORE_ACCESSORY_MAP, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import Menu from "@menu/Menu";

interface ShopItem {
    id: number;
    isAccessory: boolean;
}

export default class AutoBuyer {
    private static shopList: ShopItem[] = [{
        id: STORE_ACCESSORY_MAP.MONKEY_TAIL,
        isAccessory: true
    }, {
        id: STORE_HAT_MAP.WINTER_CAP,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.SOLDIER_HELMET,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.BULL_HELMET,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.TANK_GEAR,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.TURRET_GEAR,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.FLIPPER_HAT,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.BOOSTER_HAT,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.EMP_HELMET,
        isAccessory: false
    }, {
        id: STORE_ACCESSORY_MAP.SHADOW_WINGS,
        isAccessory: true
    }, {
        id: STORE_HAT_MAP.SPIKE_GEAR,
        isAccessory: false
    }, {
        id: STORE_ACCESSORY_MAP.CORRUPT_X_WINGS,
        isAccessory: true
    }, {
        id: STORE_HAT_MAP.BARBARIAN_ARMOR,
        isAccessory: false
    }];

    /**
     * "Fight-First Order": the items the Hat System's rules use most in a fight first, then the rest, then the two wings
     * the original list never bought. Prices: Monkey Tail 2,000, Soldier 4,000, Bull 6,000, Booster 6,000, EMP 6,000,
     * Turret 10,000, Tank 15,000, Shadow Wings 15,000, Spike Gear 10,000, Corrupt X Wings 20,000, Barbarian 8,000,
     * Flipper 2,500, Winter Cap 600, Angel Wings 15,000, Blood Wings 20,000.
     */
    static readonly fightFirstList: readonly ShopItem[] = [
        { id: STORE_ACCESSORY_MAP.MONKEY_TAIL, isAccessory: true },
        { id: STORE_HAT_MAP.SOLDIER_HELMET, isAccessory: false },
        { id: STORE_HAT_MAP.BULL_HELMET, isAccessory: false },
        { id: STORE_HAT_MAP.BOOSTER_HAT, isAccessory: false },
        { id: STORE_HAT_MAP.EMP_HELMET, isAccessory: false },
        { id: STORE_HAT_MAP.TURRET_GEAR, isAccessory: false },
        { id: STORE_HAT_MAP.TANK_GEAR, isAccessory: false },
        { id: STORE_ACCESSORY_MAP.SHADOW_WINGS, isAccessory: true },
        { id: STORE_HAT_MAP.SPIKE_GEAR, isAccessory: false },
        { id: STORE_ACCESSORY_MAP.CORRUPT_X_WINGS, isAccessory: true },
        { id: STORE_HAT_MAP.BARBARIAN_ARMOR, isAccessory: false },
        { id: STORE_HAT_MAP.FLIPPER_HAT, isAccessory: false },
        { id: STORE_HAT_MAP.WINTER_CAP, isAccessory: false },
        { id: STORE_ACCESSORY_MAP.ANGEL_WINGS, isAccessory: true },
        { id: STORE_ACCESSORY_MAP.BLOOD_WINGS, isAccessory: true }
    ];

    /** Fight-First Order: buys the first item in the list we don't own yet and can afford (one purchase per call). */
    private static buyFightFirst(points: number) {
        const player = Client.player;
        if (!player) return;

        for (const entry of this.fightFirstList) {
            const owned = entry.isAccessory ? player.tails : player.skins;
            if (owned[entry.id]) continue;

            const item = (entry.isAccessory ? store.accessories : store.hats).find(e => e.id === entry.id);
            if (!item || item.price > points) continue;

            HatSystem.storeBuy(item.id, entry.isAccessory);
            return;
        }
    }

    static main(points: number) {
        if (points <= 0) return;
        if (!Menu.getValue("autoBuy")) return;

        if (Menu.getValue("autoBuy:fightFirst")) {
            this.buyFightFirst(points);
            return;
        }

        const currentItem = this.shopList[0];
        if (!currentItem) return;

        const player = Client.player;
        if (!player) return;

        const items = currentItem.isAccessory ? store.accessories : store.hats;
        const item = items.find(e => e.id === currentItem.id);
        const group = currentItem.isAccessory ? player.tails : player.skins;

        // Skip what we already own first: this used to happen only once we could afford it, holding up cheaper items.
        if (group[currentItem.id]) {
            this.shopList.shift();
            this.main(points);
            return;
        }

        if (item && item.price <= points) {
            HatSystem.storeBuy(item.id, currentItem.isAccessory);
        }
    }
}