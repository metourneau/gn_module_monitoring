import { MonitoringObject } from './../class/monitoring-object';
import { Injectable } from '@angular/core';
import { Observable, of } from '@librairies/rxjs';

import { ConfigService } from './config.service';
import { DataMonitoringObjectService } from './data-monitoring-object.service';
import { DataUtilsService } from './data-utils.service';
import { Utils } from '../utils/utils';
import { mergeMap } from '@librairies/rxjs/operators';

@Injectable()
export class MonitoringObjectService {
  constructor(
    private _configService: ConfigService,
    private _dataMonitoringObjectService: DataMonitoringObjectService,
    private _dataUtilsService: DataUtilsService
  ) { }

  _cache = {};

  configUtilsDict = {
    'user': {
      'fieldName': 'nom_complet'
    },
    'nomenclature': {
      'fieldName': 'label_fr'
    },
    'taxonomy': {
      'fieldName': 'nom_vern'
    }
  };

  cache(modulePath, objectType = null, id = null) {
    let cache = this._cache[modulePath] = this._cache[modulePath] || {};

    if (!objectType) {
      return cache;
    }
    cache = cache[objectType] = cache[objectType] || {};

    if (objectType === 'module') {
      return cache;
    }

    if (id) {
      cache = cache[id] = cache[id] || null;
    }
    return cache;
  }

  setCache(obj: MonitoringObject, objData) {
    // post ou update

    // object
    if (obj.objectType === 'module') {
      const cache = this.cache(obj.modulePath);
      cache['module'] = objData;
    } else {
      const cache = this.cache(obj.modulePath, obj.objectType);
      cache[obj.id] = objData;
    }

    // children
    for (const childrenType of Object.keys(objData.children)) {
      const childrenData = objData.children[childrenType];
      const cacheChildren = this.cache(obj.modulePath, childrenType);
      console.log(Utils.copy(cacheChildren));
      console.log(Utils.copy(this._cache));
      for (const childData of childrenData) {
        cacheChildren[childData.id] = childData;
        console.log(Utils.copy(cacheChildren));

      }
    }

    // parent
    const parent = this.getParentFromCache(obj);
    if (parent) {
      console.log('aa', parent)
      const index = parent.children[obj.objectType]
        .findIndex((child) => {
          return child.id === obj.id;
        });
      parent.children[obj.objectType].splice(index, 1, objData);
    }

    console.log('after set', this._cache);

  }

  getParentFromCache(obj) {
    if (!obj.parentType()) { return; }
    const parentData = this.cache(obj.modulePath, obj.parentType(), obj.parentId);
    return Object.keys(parentData).length ? parentData : null;
  }

  getFromCache(obj) {
    // get
    const objData = this.cache(obj.modulePath, obj.objectType, obj.id);
    return Object.keys(objData).length ? objData : null;
  }

  deleteCache(obj) {
    let index: Number;
    // children
    for (const childrenType of obj.childrenTypes()) {
      const childrenData = obj.children[childrenType];
      for (const childData of childrenData) {
        const child = new MonitoringObject(obj.modulePath, childrenType, childData.id, this);
        this.deleteCache(child);
      }
    }

    // parent
    const parent = this.getParentFromCache(obj);
    if (parent && Object.keys(parent).length) {
      index = parent.children[obj.objectType]
        .findIndex((child) => {
          return child.id === obj.id;
        });
      parent.children[obj.objectType].splice(index, 1);
    }

    // delete
    const objectsCache = this.cache(obj.modulePath, obj.objectType);
    index = objectsCache.findIndex(data => data.id === obj.id);
    objectsCache.splice(index, 1);
  }

  configUtils(elem) {
    const confUtil = elem.type_util && this.configUtilsDict[elem.type_util];
    return confUtil;
  }

  toForm(elem, val): Observable<any> {
    let x = val;

    // valeur par default depuis la config schema
    x = x || elem.value;

    x = (x === undefined) ? null : x;

    switch (elem.type_widget) {
      case 'date': {
        const date = new Date(x);
        x = x ? { 'year': date.getUTCFullYear(), 'month': date.getUTCMonth() + 1, 'day': date.getUTCDate() } : null;
        break;
      }
      case 'observers': {
        x = !(x instanceof Array) ? [x] : x;
        break;
      }
      case 'taxonomy': {
        x = x ? this._dataUtilsService.getUtil('taxonomy', x, 'all') : null;
        break;
      }
    }

    if (elem.type_util === 'nomenclature' && Utils.isObject(x)) {
      x = this._dataUtilsService
        .getNomenclature(x.code_nomenclature_type, x.cd_nomenclature)
        .pipe(
          mergeMap((nomenclature) => {
            return of(nomenclature['id_nomenclature']);
          })
        );
    }

    x = x || null; // sinon pb assignement dictionnaire

    x = (x instanceof Observable) ? x : of(x);
    return x;
  }

  fromForm(elem, val) {
    let x = val;
    switch (elem.type_widget) {
      case 'date': {
        x = (x && x.year && x.month && x.day) ? `${x.year}-${x.month}-${x.day}` : null;
        break;
      }
      case 'observers': {
        x = elem.max_length === 1 && x instanceof Array && x.length === 1 ? x[0] : x;
        break;
      }
      case 'taxonomy': {
        x = x instanceof Object ? x.cd_nom : x;
        break;
      }
    }
    return x;
  }

  dateFromString(s_date) {
    const v_date = s_date.split('/');
    if (v_date.length !== 3) {
      return null;
    }
    const date = Date.parse(`${v_date[2]}-${v_date[1]}-${v_date[0]}`);
    return date;
  }

  numberFromString(s) {
    const v = s.split(' ');
    const s_n = v[0];
    const v_n = s_n.split('.');
    v_n[0] = Number(v_n[0]);
    v_n[1] = Number(v_n[1]);
    return (v_n.length > 1 && v_n[0]) ? v_n : null;
  }

  dataMonitoringObjectService(): DataMonitoringObjectService {
    return this._dataMonitoringObjectService;
  }

  dataUtilsService(): DataUtilsService {
    return this._dataUtilsService;
  }

  configService(): ConfigService {
    return this._configService;
  }

}
