import { parseListQuery, catalogPage } from "../utils/list-query.js";
import {
  listDistrictLevelUnitsByProvince,
  listProvinces,
} from "../services/location.service.js";

const listProvincesHandler = async (request, response, next) => {
  try {
    const options = parseListQuery(request.query, { optional: true });
    const provinces = await listProvinces();

    return response.status(200).json(catalogPage("provinces", provinces, options));
  } catch (error) {
    return next(error);
  }
};

const listDistrictLevelUnitsHandler = async (request, response, next) => {
  try {
    const options = parseListQuery(request.query, { optional: true });
    const districtLevelUnits = await listDistrictLevelUnitsByProvince(
      request.params.provinceCode,
    );

    return response.status(200).json(catalogPage("districtLevelUnits", districtLevelUnits, options));
  } catch (error) {
    return next(error);
  }
};

export { listDistrictLevelUnitsHandler, listProvincesHandler };
