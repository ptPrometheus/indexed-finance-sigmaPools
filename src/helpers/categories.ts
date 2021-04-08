import { ListManager } from "../../generated/schema";

export function getListManager(): ListManager {
  let listManager = ListManager.load('LISTS');
  if (listManager == null) {
    listManager = new ListManager('LISTS');
    listManager.categoryIndex = 0;
    listManager.poolsList = [];
    listManager.save();
  }
  return listManager as ListManager;
}