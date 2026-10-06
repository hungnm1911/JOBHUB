import {
  listDistrictLevelUnitsByProvince,
  listProvinces,
} from "../services/location.service.js";

const listProvincesHandler = async (request, response, next) => {
  try {
    const provinces = await listProvinces();

    return response.status(200).json({ provinces });
  } catch (error) {
    return next(error);
  }
};

const listDistrictLevelUnitsHandler = async (request, response, next) => {
  try {
    const districtLevelUnits = await listDistrictLevelUnitsByProvince(
      request.params.provinceCode,
    );

    return response.status(200).json({ districtLevelUnits });
  } catch (error) {
    return next(error);
  }
};

export { listDistrictLevelUnitsHandler, listProvincesHandler };
